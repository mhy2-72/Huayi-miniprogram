const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function logAdminAction(adminId, adminName, action, target, detail) {
  try {
    await db.collection('AdminLogs').add({
      data: { adminId, adminName, action, target, detail, createTime: db.serverDate() }
    });
  } catch (e) { console.error('日志记录失败', e); }
}

async function getCurrentAdmin() {
  const { OPENID } = cloud.getWXContext();
  const user = await db.collection('users').doc(OPENID).get().catch(() => null);
  if (!user || !user.data) return null;
  if (!user.data.admin) return null;
  return user.data;
}

function calcAge(birthdayStr) {
  if (!birthdayStr) return 0;
  const birth = new Date(birthdayStr.replace(/-/g, '/'));
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : 0;
}

function getRoleByAge(age) {
  if (age >= 12 && age <= 17) return 'teen';
  if (age >= 18 && age <= 35) return 'young';
  if (age >= 36 && age <= 59) return 'middle';
  if (age >= 60) return 'elder';
  return 'teen';
}

async function handleSubmitComplaint(event) {
  const { type, description, evidenceImages, userChanges, taskId, subType, targetPOIId, newPOI, certType } = event;
  const { OPENID } = cloud.getWXContext();
  let user = null;
  let userId = OPENID;
  try {
    const userRes = await db.collection('users').doc(OPENID).get();
    user = userRes.data;
    userId = userRes._id || OPENID;
  } catch (e) { user = null; }

  const complaintData = {
    type, description,
    evidenceImages: evidenceImages || [],
    status: 'pending',
    userId,
    userName: user ? user.nickName : '未知',
    createTime: db.serverDate()
  };
  if (type === 'userInfo') complaintData.userChanges = userChanges || [];
  if (type === 'task' && taskId) complaintData.taskId = taskId;
  if (type === 'livingCircle') {
    complaintData.subType = subType || 'error';
    if (subType === 'error' && targetPOIId) complaintData.targetPOIId = targetPOIId;
    if (subType === 'addition' && newPOI) complaintData.newPOI = newPOI;
  }
  if (type === 'certification' && certType) {
    complaintData.certType = certType;
  }

  const res = await db.collection('complain').add({ data: complaintData });
  return { code: 0, data: { _id: res._id } };
}

exports.main = async (event) => {
  try {
    const { action } = event;

    // ===== 公开操作：无需管理员权限 =====
    if (action === 'submitComplaint') {
      return handleSubmitComplaint(event);
    }

    const admin = await getCurrentAdmin();
    if (!admin) return { code: 403, msg: '无权限' };

    switch (action) {
      case 'getStats': {
        const countSafe = async (col, where = {}) => {
          try { return (await db.collection(col).where(where).count()).total; }
          catch (e) { return 0; }
        };
        const [pendingComplaints, pendingExchanges, totalTasks, totalUsers, pendingCertifications] = await Promise.all([
          countSafe('complain', { status: 'pending' }),
          countSafe('exchangeCodes', { status: 'pending' }),
          countSafe('tasks'),
          countSafe('users', { admin: _.neq(true) }),
          countSafe('complain', { type: 'certification', status: 'pending' })
        ]);
        return { code: 0, data: {
          pendingComplaints,
          pendingExchanges,
          totalTasks,
          totalUsers,
          pendingCertifications
        }};
      }

      case 'getComplaints': {
        const { filter = 'pending' } = event;
        let query = {};
        if (filter === 'pending') query = { status: 'pending' };
        else if (filter === 'resolved') query = { status: db.command.in(['resolved', 'rejected']) };
        // 'all' or default: no status filter

        const MAX_RESULTS = 100;
        let complaintRes;
        try {
          complaintRes = await db.collection('complain')
            .where(query)
            .orderBy('createTime', 'desc')
            .limit(MAX_RESULTS)
            .get();
        } catch (e) {
          console.error('getComplaints query error:', e);
          return { code: 500, msg: '查询失败: ' + (e.errMsg || e.message) };
        }

        const complaints = complaintRes.data || [];
        const enrichedComplaints = [];

        for (const c of complaints) {
          // Ensure typeText fallback
          if (!c.type) c.type = 'unknown';

          // Convert evidenceImages from cloud fileIDs to temp URLs if needed
          if (c.evidenceImages && Array.isArray(c.evidenceImages)) {
            try {
              const needConvert = c.evidenceImages.some(u => typeof u === 'string' && u.startsWith('cloud://'));
              if (needConvert) {
                const urlRes = await cloud.getTempFileURL({ fileList: c.evidenceImages });
                if (urlRes.fileList) {
                  c.evidenceImages = urlRes.fileList.map(f => f.tempFileURL).filter(Boolean);
                }
              }
            } catch (e) {}
          } else {
            c.evidenceImages = [];
          }

          // Enrich user names
          if (c.userId) {
            try {
              const userRes = await db.collection('users').doc(c.userId).get();
              if (userRes.data) {
                c.userName = c.userName || userRes.data.nickName;
                c.userAvatar = userRes.data.avatarUrl;
              }
            } catch (e) {}
          }

          // Enrich exchange records for exchange complaints
          if (c.type === 'exchange' && c.userId) {
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
            try {
              const exchangeRes = await db.collection('exchangeCodes')
                .where({ userId: c.userId, createTime: _.gte(threeDaysAgo) })
                .orderBy('createTime', 'desc')
                .limit(5)
                .get();
              if (exchangeRes.data.length > 0) {
                c.exchangeRecords = exchangeRes.data.map(r => ({
                  productName: r.productName,
                  code: r.code,
                  time: r.createTime ? (r.createTime instanceof Date ? r.createTime.toLocaleString() : new Date(r.createTime).toLocaleString()) : '',
                  status: r.status
                }));
              }
            } catch (e) {}
          }

          // Enrich task details for task complaints
          if (c.type === 'task' && c.taskId) {
            try {
              const taskRes = await db.collection('tasks').doc(c.taskId).get();
              if (taskRes.data) {
                c.taskInfo = {
                  description: taskRes.data.description,
                  status: taskRes.data.status,
                  elderId: taskRes.data.elderId,
                  youthId: taskRes.data.youthId
                };
                // Enrich task user names for the admin view
                if (taskRes.data.elderId) {
                  try {
                    const u = await db.collection('users').doc(taskRes.data.elderId).get();
                    if (u.data) c.taskInfo.elderName = u.data.nickName;
                  } catch (e) {}
                }
                if (taskRes.data.youthId) {
                  try {
                    const u = await db.collection('users').doc(taskRes.data.youthId).get();
                    if (u.data) c.taskInfo.youthName = u.data.nickName;
                  } catch (e) {}
                }
              }
            } catch (e) {}
          }

          enrichedComplaints.push(c);
        }

        return { code: 0, data: enrichedComplaints };
      }

      case 'handleComplaint': {
        const { complaintId, result, adminNote } = event;
        const complaintRes = await db.collection('complain').doc(complaintId).get();
        const complaint = complaintRes.data;

        await db.collection('complain').doc(complaintId).update({
          data: { status: result, adminNote, handleTime: db.serverDate() }
        });

        const isApproved = result === 'resolved';

        // Auto-add living circle POI if it's an addition complaint and approved
        if (isApproved && complaint.type === 'livingCircle' && complaint.subType === 'addition' && complaint.newPOI) {
          const poi = complaint.newPOI;
          const id = `${poi.category || 'user'}_${Date.now()}`;
          const poiData = {
            id,
            name: poi.name,
            category: poi.category,
            categoryName: poi.categoryName || '',
            address: poi.address,
            rating: poi.rating || 4.0,
            desc: poi.desc || '',
            createTime: db.serverDate(),
            userSubmitted: true,
            complaintId
          };
          if (poi.latitude) poiData.latitude = poi.latitude;
          if (poi.longitude) poiData.longitude = poi.longitude;
          await db.collection('livingCirclePOIs').add({ data: poiData });
        }

        // Grant qualification if it's a certification complaint and approved
        if (isApproved && complaint.type === 'certification' && complaint.certType && complaint.userId) {
          const certTypeNames = { nursing: '护理', repair: '修理' };
          const certTypeName = certTypeNames[complaint.certType] || complaint.certType;
          try {
            const userRes = await db.collection('users').doc(complaint.userId).get();
            const user = userRes.data;
            const certifications = (user.certifications || []).filter(c => c.type !== complaint.certType);
            certifications.push({
              type: complaint.certType,
              name: certTypeName,
              status: 'approved',
              approvedAt: db.serverDate(),
              source: 'complaint',
              complaintId
            });
            await db.collection('users').doc(complaint.userId).update({ data: { certifications } });
          } catch (e) { console.error('更新用户资质失败', e); }
        }

        if (complaint.userId) {
          const adminReply = adminNote || '';
          let message;
          const certTypeNames = { nursing: '护理', repair: '修理' };
          if (complaint.type === 'certification' && isApproved) {
            const certName = certTypeNames[complaint.certType] || complaint.certType;
            message = adminReply || `恭喜！您的${certName}资质认证已通过审核，现在可以接取需要${certName}资质的任务了。`;
          } else if (complaint.type === 'certification' && !isApproved) {
            message = adminReply || '很抱歉，您的资质认证未通过审核，请根据反馈重新提交。';
          } else if (complaint.type === 'livingCircle' && complaint.subType === 'addition' && isApproved) {
            message = adminReply || '您提交的生活圈新地点已审核通过，已自动添加到生活圈。';
          } else if (complaint.type === 'livingCircle' && complaint.subType === 'error' && isApproved) {
            message = adminReply || '您反馈的生活圈信息错误已审核通过，管理员将尽快修正。';
          } else {
            message = adminReply || (isApproved ? '您的申诉已处理通过，感谢反馈。' : '很抱歉，您的申诉未通过审核。');
          }

          await db.collection('notifications').add({
            data: {
              userId: complaint.userId,
              title: '申诉处理结果',
              message: message,
              content: message,
              type: 'complaint',
              result: isApproved ? 'approved' : 'rejected',
              adminReply: adminReply,
              read: false,
              createTime: db.serverDate()
            }
          });
        }

        await logAdminAction(admin._id, admin.nickName, `处理申诉(${result === 'resolved' ? '通过' : '驳回'})`, `申诉ID: ${complaintId}`, adminNote || '');
        return { code: 0, msg: '处理成功' };
      }

      case 'getProducts': {
        const res = await db.collection('products').get();
        return { code: 0, data: res.data };
      }

      case 'addProduct': {
        const { name, points, stock, description } = event;
        const res = await db.collection('products').add({
          data: { name, points, stock, description, createTime: db.serverDate() }
        });
        await logAdminAction(admin._id, admin.nickName, '添加商品', name || '', `积分:${points}, 库存:${stock}`);
        return { code: 0, data: { _id: res._id } };
      }

      case 'updateProduct': {
        const { productId, name, points, stock, description } = event;
        await db.collection('products').doc(productId).update({ data: { name, points, stock, description } });
        await logAdminAction(admin._id, admin.nickName, '更新商品', name || productId, '');
        return { code: 0 };
      }

      case 'deleteProduct': {
        const { productId } = event;
        const productRes = await db.collection('products').doc(productId).get();
        const productName = productRes.data.name;
        await db.collection('products').doc(productId).remove();
        await logAdminAction(admin._id, admin.nickName, '删除商品', productName, '');
        return { code: 0 };
      }

      case 'updateProductStock': {
        const { productId, stock } = event;
        await db.collection('products').doc(productId).update({ data: { stock } });
        await logAdminAction(admin._id, admin.nickName, '更新库存', productId, `新库存:${stock}`);
        return { code: 0 };
      }

      case 'getExchangeCodes': {
        const res = await db.collection('exchangeCodes').orderBy('createTime', 'desc').limit(200).get();
        const codes = [];
        for (const c of res.data) {
          let userName = c.userName || '未知';
          if (c.userId) {
            try {
              const userRes = await db.collection('users').doc(c.userId).get();
              if (userRes.data) userName = userRes.data.nickName || userName;
            } catch (e) {}
          }
          codes.push({ ...c, userName });
        }
        return { code: 0, data: codes };
      }

      case 'getTasks': {
        const { filter = 'all' } = event;
        let query = {};
        if (filter !== 'all') query = { status: filter };
        let taskRes;
        try {
          taskRes = await db.collection('tasks').where(query).orderBy('createTime', 'desc').limit(200).get();
        } catch (e) {
          console.error('getTasks error:', e);
          return { code: 500, msg: '查询失败: ' + (e.errMsg || e.message) };
        }

        const tasks = [];
        const userCache = {};

        for (const t of (taskRes.data || [])) {
          let elderName = t.elderName || '未知';
          let youthName = t.youthName || '';

          // Look up elder name
          if (t.elderId) {
            if (!userCache[t.elderId]) {
              try {
                const u = await db.collection('users').doc(t.elderId).get();
                userCache[t.elderId] = u.data ? (u.data.nickName || '未知') : '未知';
              } catch (e) { userCache[t.elderId] = '未知'; }
            }
            elderName = userCache[t.elderId];
          }

          // Look up youth name
          if (t.youthId) {
            if (!userCache[t.youthId]) {
              try {
                const u = await db.collection('users').doc(t.youthId).get();
                userCache[t.youthId] = u.data ? (u.data.nickName || '未知') : '未知';
              } catch (e) { userCache[t.youthId] = '未知'; }
            }
            youthName = userCache[t.youthId];
          }

          tasks.push({ ...t, elderName, youthName });
        }

        return { code: 0, data: tasks };
      }

      case 'updateTask': {
        const { taskId, status, rating } = event;
        if (!taskId) return { code: 400, msg: '缺少taskId' };

        let oldTask;
        try {
          oldTask = await db.collection('tasks').doc(taskId).get();
        } catch (e) {
          return { code: 404, msg: '任务不存在' };
        }

        const oldStatus = oldTask.data.status;
        const oldRating = oldTask.data.rating || 0;

        const updateData = {};
        if (status !== undefined) updateData.status = status;

        // Rating is allowed when task becomes completed or is already completed
        if (rating !== undefined && rating !== null) {
          const newStatus = status !== undefined ? status : oldStatus;
          if (newStatus === 'completed' || oldStatus === 'completed') {
            updateData.rating = Number(rating);
          }
        }
        if (status === 'completed') updateData.completeTime = db.serverDate();
        if (status === 'cancelled') updateData.cancelTime = db.serverDate();

        await db.collection('tasks').doc(taskId).update({ data: updateData });

        // Handle rating change: adjust points
        if (updateData.rating !== undefined && updateData.rating !== oldRating) {
          const diff = (updateData.rating - oldRating) * 10;
          if (diff !== 0 && oldTask.data.youthId) {
            try {
              await db.collection('users').doc(oldTask.data.youthId).update({
                data: { points: _.inc(diff) }
              });
              await db.collection('pointHistory').add({
                data: {
                  userId: oldTask.data.youthId,
                  taskId,
                  type: 'task_rating_modify',
                  description: '管理员修改任务评分',
                  change: diff,
                  createTime: db.serverDate()
                }
              });
            } catch (e) { console.error('积分调整失败', e); }
          }
        }

        const logDetail = [];
        if (status !== undefined) logDetail.push(`状态: ${oldStatus}→${status}`);
        if (updateData.rating !== undefined) logDetail.push(`评分: ${oldRating}→${updateData.rating}`);

        await logAdminAction(admin._id, admin.nickName, '修改任务', `任务ID: ${taskId}`, logDetail.join(', ') || '无变更');
        return { code: 0 };
      }

      case 'deleteTask': {
        const { taskId } = event;
        await db.collection('tasks').doc(taskId).remove();
        await logAdminAction(admin._id, admin.nickName, '删除任务', taskId, '');
        return { code: 0 };
      }

      case 'getUsers': {
        const { keyword = '' } = event;
        let query = { admin: _.neq(true) };
        if (keyword) {
          query = _.and([
            { admin: _.neq(true) },
            _.or([
              { nickName: db.RegExp({ regexp: keyword, options: 'i' }) },
              { occupation: db.RegExp({ regexp: keyword, options: 'i' }) }
            ])
          ]);
        }
        const res = await db.collection('users').where(query).orderBy('createTime', 'desc').limit(200).get();
        return { code: 0, data: res.data };
      }

      case 'updateUser': {
        const { userId, nickName, avatarUrl, gender, occupation, birthday } = event;
        const updateData = {};
        if (nickName !== undefined) updateData.nickName = nickName;
        if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
        if (gender !== undefined) updateData.gender = gender;
        if (occupation !== undefined) updateData.occupation = occupation;

        if (birthday !== undefined) {
          updateData.birthday = birthday;
          const age = calcAge(birthday);
          updateData.age = age;
          updateData.role = getRoleByAge(age);
        }

        await db.collection('users').doc(userId).update({ data: updateData });

        const detailParts = [];
        if (nickName !== undefined) detailParts.push(`昵称:${nickName}`);
        if (birthday !== undefined) detailParts.push(`生日:${birthday}→重新分配身份组`);
        if (avatarUrl !== undefined) detailParts.push('头像已更新');

        await logAdminAction(admin._id, admin.nickName, '修改用户信息', userId, detailParts.join(', '));
        return { code: 0 };
      }

      case 'deleteUser': {
        const { userId } = event;
        await db.collection('users').doc(userId).remove();
        await logAdminAction(admin._id, admin.nickName, '删除用户', userId, '');
        return { code: 0 };
      }

      case 'getLivingCircle': {
        const configRes = await db.collection('livingCircleConfig').get();
        let categories = [], pois = [];
        if (configRes.data.length) {
          categories = configRes.data[0].categories || [];
        }
        const poisRes = await db.collection('livingCirclePOIs').get();
        pois = poisRes.data;

        // Enrich category names for POIs
        const enrichedPois = pois.map(p => {
          const cat = categories.find(c => c.key === p.category);
          return { ...p, categoryName: cat ? cat.name : p.category };
        });

        return { code: 0, data: { categories, pois: enrichedPois } };
      }

      case 'addLivingCircleCategory': {
        const { key, name } = event;
        if (!key || !name) return { code: -1, msg: '索引和名称不能为空' };
        const configRes = await db.collection('livingCircleConfig').get();
        if (configRes.data.length) {
          const categories = configRes.data[0].categories || [];
          categories.push({ key, name });
          await db.collection('livingCircleConfig').doc(configRes.data[0]._id).update({ data: { categories } });
        } else {
          await db.collection('livingCircleConfig').add({ data: { categories: [{ key, name }] } });
        }
        await logAdminAction(admin._id, admin.nickName, '添加生活圈分类', `${key}|${name}`, '');
        return { code: 0 };
      }

      case 'deleteLivingCircleCategory': {
        const { key } = event;
        const configRes = await db.collection('livingCircleConfig').get();
        if (configRes.data.length) {
          const categories = (configRes.data[0].categories || []).filter(c => c.key !== key);
          await db.collection('livingCircleConfig').doc(configRes.data[0]._id).update({ data: { categories } });
        }
        await logAdminAction(admin._id, admin.nickName, '删除生活圈分类', key, '');
        return { code: 0 };
      }

      case 'addLivingCirclePOI': {
        const { name, category, categoryName, address, latitude, longitude, rating, desc } = event;
        const id = `${category}_${Date.now()}`;
        const data = { id, name, category, address, rating, desc, createTime: db.serverDate() };
        if (categoryName) data.categoryName = categoryName;
        if (latitude) data.latitude = latitude;
        if (longitude) data.longitude = longitude;
        await db.collection('livingCirclePOIs').add({ data });
        await logAdminAction(admin._id, admin.nickName, '添加生活圈地点', name, '');
        return { code: 0 };
      }

      case 'updateLivingCirclePOI': {
        const { poiId, name, category, categoryName, address, latitude, longitude, rating, desc } = event;
        const data = { name, category, address, rating, desc };
        if (categoryName) data.categoryName = categoryName;
        if (latitude !== undefined) data.latitude = latitude;
        if (longitude !== undefined) data.longitude = longitude;
        await db.collection('livingCirclePOIs').doc(poiId).update({ data });
        await logAdminAction(admin._id, admin.nickName, '更新生活圈地点', name || poiId, '');
        return { code: 0 };
      }

      case 'deleteLivingCirclePOI': {
        const { poiId } = event;
        await db.collection('livingCirclePOIs').doc(poiId).remove();
        await logAdminAction(admin._id, admin.nickName, '删除生活圈地点', poiId, '');
        return { code: 0 };
      }

      case 'getLogs': {
        const res = await db.collection('AdminLogs').orderBy('createTime', 'desc').limit(200).get();
        return { code: 0, data: res.data };
      }

      case 'getQualifications': {
        const { filter = 'pending' } = event;
        const complaintTypes = ['certification'];
        let query = { type: 'certification' };
        if (filter === 'pending') query.status = 'pending';
        else if (filter === 'resolved') query.status = db.command.in(['resolved', 'rejected']);

        const MAX_RESULTS = 100;
        const complaintRes = await db.collection('complain')
          .where(query)
          .orderBy('createTime', 'desc')
          .limit(MAX_RESULTS)
          .get();

        const complaints = complaintRes.data || [];
        const enriched = [];
        const certTypeNames = { nursing: '护理', repair: '修理' };

        for (const c of complaints) {
          if (c.evidenceImages && Array.isArray(c.evidenceImages)) {
            try {
              const needConvert = c.evidenceImages.some(u => typeof u === 'string' && u.startsWith('cloud://'));
              if (needConvert) {
                const urlRes = await cloud.getTempFileURL({ fileList: c.evidenceImages });
                if (urlRes.fileList) {
                  c.evidenceImages = urlRes.fileList.map(f => f.tempFileURL).filter(Boolean);
                }
              }
            } catch (e) {}
          } else {
            c.evidenceImages = [];
          }

          if (c.userId) {
            try {
              const userRes = await db.collection('users').doc(c.userId).get();
              if (userRes.data) {
                c.userName = userRes.data.nickName;
                c.userAvatar = userRes.data.avatarUrl;
                c.userCertifications = userRes.data.certifications || [];
              }
            } catch (e) {}
          }

          c.certTypeName = certTypeNames[c.certType] || c.certType;
          enriched.push(c);
        }

        return { code: 0, data: enriched };
      }

      case 'handleQualification': {
        const { complaintId, result, adminNote } = event;
        const complaintRes = await db.collection('complain').doc(complaintId).get();
        const complaint = complaintRes.data;

        await db.collection('complain').doc(complaintId).update({
          data: { status: result, adminNote, handleTime: db.serverDate() }
        });

        const isApproved = result === 'resolved';

        if (isApproved && complaint.certType && complaint.userId) {
          const certTypeNames = { nursing: '护理', repair: '修理' };
          const certTypeName = certTypeNames[complaint.certType] || complaint.certType;
          try {
            const userRes = await db.collection('users').doc(complaint.userId).get();
            const user = userRes.data;
            const certifications = (user.certifications || []).filter(c => c.type !== complaint.certType);
            certifications.push({
              type: complaint.certType,
              name: certTypeName,
              status: 'approved',
              approvedAt: db.serverDate(),
              source: 'complaint',
              complaintId
            });
            await db.collection('users').doc(complaint.userId).update({ data: { certifications } });
          } catch (e) { console.error('更新用户资质失败', e); }
        }

        if (complaint.userId) {
          const certTypeNames = { nursing: '护理', repair: '修理' };
          const certName = certTypeNames[complaint.certType] || complaint.certType;
          const message = isApproved
            ? (adminNote || `恭喜！您的${certName}资质认证已通过审核，现在可以接取需要${certName}资质的任务了。`)
            : (adminNote || '很抱歉，您的资质认证未通过审核，请根据反馈重新提交。');

          await db.collection('notifications').add({
            data: {
              userId: complaint.userId,
              title: '资质认证审核结果',
              message,
              content: message,
              type: 'certification',
              result: isApproved ? 'approved' : 'rejected',
              adminReply: adminNote,
              read: false,
              createTime: db.serverDate()
            }
          });
        }

        await logAdminAction(admin._id, admin.nickName, `资质审核(${result === 'resolved' ? '通过' : '驳回'})`, `申诉ID: ${complaintId}`, adminNote || '');
        return { code: 0, msg: '处理成功' };
      }

      case 'addUserCertification': {
        const { userId, certType } = event;
        if (!userId || !certType) return { code: -1, msg: '缺少参数' };

        const certTypeNames = { nursing: '护理', repair: '修理' };
        const certTypeName = certTypeNames[certType] || certType;

        const userRes = await db.collection('users').doc(userId).get();
        const user = userRes.data;
        const certifications = (user.certifications || []).filter(c => c.type !== certType);
        certifications.push({
          type: certType,
          name: certTypeName,
          status: 'approved',
          approvedAt: db.serverDate(),
          source: 'admin',
          adminId: admin._id,
          adminName: admin.nickName
        });
        await db.collection('users').doc(userId).update({ data: { certifications } });

        await logAdminAction(admin._id, admin.nickName, `添加用户资质(${certTypeName})`, userId, '');
        return { code: 0, msg: '已添加' };
      }

      case 'removeUserCertification': {
        const { userId, certType } = event;
        if (!userId || !certType) return { code: -1, msg: '缺少参数' };

        const userRes = await db.collection('users').doc(userId).get();
        const user = userRes.data;
        const certifications = (user.certifications || []).filter(c => c.type !== certType);
        await db.collection('users').doc(userId).update({ data: { certifications } });

        await logAdminAction(admin._id, admin.nickName, `移除用户资质(${certType})`, userId, '');
        return { code: 0, msg: '已移除' };
      }

      default:
        return { code: 400, msg: `未知操作: ${action}` };
    }
  } catch (error) {
    console.error('adminOperations error:', error);
    return { code: 500, msg: error.message || '服务器错误' };
  }
};
