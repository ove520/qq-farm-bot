let selectedUsers = new Set();

async function loadUsers() {
    const container = $('users-list');
    if (!container) return;
    container.innerHTML = '<div class="loading">加载中...</div>';
    selectedUsers.clear();
    updateBatchDeleteButton();
    
    try {
        const result = await api('/api/admin/users');
        const data = result.data || result;
        console.log('用户数据:', data);
        if (!data || !data.length) {
            container.innerHTML = '<div class="empty">暂无用户</div>';
            return;
        }
        container.innerHTML = data.map(u => {
            console.log('用户:', u.username, '- expiresAt:', u.card?.expiresAt, '类型:', typeof u.card?.expiresAt);
            
            let expiresAt = '永久';
            if (u.card && u.card.expiresAt !== null && u.card.expiresAt !== undefined) {
                const timestamp = Number(u.card.expiresAt);
                if (!isNaN(timestamp) && timestamp > 0) {
                    expiresAt = new Date(timestamp).toLocaleString();
                }
            }
            
            const status = u.card?.enabled !== false ? '正常' : '已封禁';
            const statusClass = u.card?.enabled !== false ? 'status-normal' : 'status-banned';
            const isAdmin = u.role === 'admin';
            
            return `
            <div class="user-item" data-username="${u.username}">
                <div class="user-select">
                    ${!isAdmin ? `<input type="checkbox" class="user-checkbox" data-username="${u.username}" onchange="toggleUserSelection('${u.username}')">` : ''}
                </div>
                <div class="user-content">
                    <div class="user-header">
                        <span class="username">${escapeHtml(u.username)}${isAdmin ? ' <span class="badge-admin">管理员</span>' : ''}</span>
                        <span class="user-status ${statusClass}">${status}</span>
                    </div>
                    <div class="user-password">
                        <span class="label">密码:</span>
                        <span class="password-value" id="pwd-${u.username}">********</span>
                        <button class="btn btn-xs" onclick="togglePassword('${u.username}', '${u.password}')">显示</button>
                        <button class="btn btn-xs btn-copy" onclick="copyPassword('${u.username}', '${u.password}')">复制</button>
                    </div>
                    <div class="user-card-code">卡密: ${u.card?.code || '-'}</div>
                    <div class="user-expiry">到期时间: ${expiresAt}</div>
                    <div class="user-actions">
                        <button class="btn btn-sm" onclick="editUserExpiry('${u.username}')">修改到期时间</button>
                        <button class="btn btn-sm" onclick="toggleUserBan('${u.username}')">${u.card?.enabled ? '封禁' : '解封'}</button>
                        ${!isAdmin ? `<button class="btn btn-sm btn-danger" onclick="deleteUser('${u.username}')">删除用户</button>` : ''}
                    </div>
                </div>
            </div>
        `}).join('');
    } catch (e) {
        console.error('加载用户失败:', e);
        container.innerHTML = '<div class="error">加载失败，请查看控制台</div>';
    }
}

window.togglePassword = (username, passwordHash) => {
    const pwdEl = $(`pwd-${username}`);
    const btn = pwdEl.nextElementSibling;
    if (pwdEl.textContent === '********') {
        pwdEl.textContent = passwordHash;
        btn.textContent = '隐藏';
    } else {
        pwdEl.textContent = '********';
        btn.textContent = '显示';
    }
};

window.copyPassword = (username, plainPassword) => {
    navigator.clipboard.writeText(plainPassword).then(() => {
        showAlert('提示', '密码已复制到剪贴板');
    }).catch(err => {
        console.error('复制失败:', err);
        showAlert('错误', '复制失败，请手动复制');
    });
};

window.toggleUserSelection = (username) => {
    const checkbox = document.querySelector(`.user-checkbox[data-username="${username}"]`);
    if (checkbox.checked) {
        selectedUsers.add(username);
    } else {
        selectedUsers.delete(username);
    }
    updateBatchDeleteButton();
};

function updateBatchDeleteButton() {
    const btn = $('btn-batch-delete-users');
    if (btn) {
        if (selectedUsers.size > 0) {
            btn.style.display = 'inline-flex';
            btn.innerHTML = `<i class="fas fa-trash"></i> 批量删除 (${selectedUsers.size})`;
        } else {
            btn.style.display = 'none';
        }
    }
}

window.batchDeleteUsers = async () => {
    if (selectedUsers.size === 0) return;
    
    const usernames = Array.from(selectedUsers);
    showConfirm(
        '批量删除用户',
        `确定要删除选中的 ${usernames.length} 个用户吗？\n\n⚠️ 警告：此操作将同时删除：\n• 用户账号信息\n• 该用户的所有QQ农场账号\n• 该用户的所有配置\n• 该用户的所有操作日志\n\n此操作不可恢复！`,
        async () => {
            try {
                const result = await api('/api/admin/users/batch-delete', 'POST', { usernames });
                if (result && result.ok) {
                    const { deleted, failed, deletedAccounts } = result.data || {};
                    showAlert('成功', `成功删除 ${deleted} 个用户${failed > 0 ? `，失败 ${failed} 个` : ''}\n同时删除了 ${deletedAccounts} 个账号`);
                    selectedUsers.clear();
                    loadUsers();
                } else {
                    showAlert('错误', result.error || '删除失败');
                }
            } catch (e) {
                console.error('批量删除用户失败:', e);
                showAlert('错误', '删除失败: ' + e.message);
            }
        }
    );
};

window.editUserExpiry = async (username) => {
    const modal = $('modal-edit-expiry');
    if (!modal) {
        const newExpiry = prompt('请输入新的到期时间 (格式: YYYY-MM-DD HH:mm:ss，留空表示永久):');
        if (newExpiry === null) return;
        let expiresAt = null;
        if (newExpiry.trim() !== '') {
            const date = new Date(newExpiry);
            if (isNaN(date.getTime())) {
                showAlert('错误', '日期格式错误');
                return;
            }
            expiresAt = date.getTime();
        }
        const result = await api(`/api/admin/users/${encodeURIComponent(username)}`, 'PUT', { expiresAt });
        if (result) {
            showAlert('成功', '修改成功');
            loadUsers();
        }
        return;
    }
    
    const usernameInput = $('edit-expiry-username');
    if (usernameInput) usernameInput.value = username;
    
    const result = await api('/api/admin/users');
    const users = result.data || result;
    const user = users.find(u => u.username === username);
    
    const dateInput = $('edit-expiry-date');
    const timeInput = $('edit-expiry-time');
    const permanentCheckbox = $('edit-expiry-permanent');
    
    if (user && user.card && user.card.expiresAt) {
        const date = new Date(user.card.expiresAt);
        if (dateInput) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            dateInput.value = `${year}-${month}-${day}`;
        }
        if (timeInput) {
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            timeInput.value = `${hours}:${minutes}`;
        }
        if (permanentCheckbox) permanentCheckbox.checked = false;
    } else {
        if (dateInput) dateInput.value = '';
        if (timeInput) timeInput.value = '23:59';
        if (permanentCheckbox) permanentCheckbox.checked = true;
    }
    
    modal.classList.add('show');
};

window.toggleUserBan = async (username) => {
    const result = await api('/api/admin/users');
    const users = result.data || result;
    const user = users.find(u => u.username === username);
    if (!user) return;
    const newEnabled = !user.card?.enabled;
    const action = newEnabled ? '解封' : '封禁';
    
    showConfirm('确认' + action, `确定要${action}用户 ${username} 吗？${newEnabled ? '' : '\n封禁后该用户将无法登录系统'}`, async () => {
        const updateResult = await api(`/api/admin/users/${encodeURIComponent(username)}`, 'PUT', { enabled: newEnabled });
        if (updateResult) {
            showAlert('成功', `${action}成功`);
            loadUsers();
        }
    });
};

window.deleteUser = async (username) => {
    showConfirm(
        '删除用户',
        `确定要删除用户 ${username} 吗？\n\n⚠️ 警告：此操作将同时删除：\n• 用户账号信息\n• 该用户的所有QQ农场账号\n• 该用户的所有配置\n• 该用户的所有操作日志\n\n此操作不可恢复！`,
        async () => {
            try {
                const result = await api(`/api/admin/users/${encodeURIComponent(username)}`, 'DELETE');
                if (result && result.ok) {
                    const deletedAccounts = result.data?.deletedAccounts || 0;
                    showAlert('成功', `已删除用户 ${username}\n同时删除了 ${deletedAccounts} 个账号`);
                    loadUsers();
                } else {
                    showAlert('错误', result.error || '删除失败');
                }
            } catch (e) {
                console.error('删除用户失败:', e);
                showAlert('错误', '删除失败: ' + e.message);
            }
        }
    );
};

document.addEventListener('DOMContentLoaded', () => {
    const usersPage = document.getElementById('page-users');
    if (usersPage) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.classList.contains('active')) {
                    loadUsers();
                }
            });
        });
        observer.observe(usersPage, { attributes: true, attributeFilter: ['class'] });
        
        if (usersPage.classList.contains('active')) {
            loadUsers();
        }
    }
    
    const btnBatchDelete = $('btn-batch-delete-users');
    if (btnBatchDelete) {
        btnBatchDelete.addEventListener('click', window.batchDeleteUsers);
    }
    
    const permanentCheckbox = $('edit-expiry-permanent');
    const dateInput = $('edit-expiry-date');
    const timeInput = $('edit-expiry-time');
    
    if (permanentCheckbox) {
        permanentCheckbox.addEventListener('change', () => {
            const isPermanent = permanentCheckbox.checked;
            if (dateInput) dateInput.disabled = isPermanent;
            if (timeInput) timeInput.disabled = isPermanent;
        });
    }
    
    const btnSaveExpiry = $('btn-save-expiry');
    if (btnSaveExpiry) {
        btnSaveExpiry.addEventListener('click', async () => {
            const username = $('edit-expiry-username').value;
            const isPermanent = $('edit-expiry-permanent').checked;
            
            let expiresAt = null;
            if (!isPermanent) {
                const dateValue = $('edit-expiry-date').value;
                const timeValue = $('edit-expiry-time').value || '23:59';
                
                if (!dateValue) {
                    showAlert('错误', '请选择日期或勾选永久');
                    return;
                }
                
                const dateTime = `${dateValue} ${timeValue}:00`;
                const date = new Date(dateTime);
                
                if (isNaN(date.getTime())) {
                    showAlert('错误', '日期格式错误');
                    return;
                }
                
                expiresAt = date.getTime();
            }
            
            const result = await api(`/api/admin/users/${encodeURIComponent(username)}`, 'PUT', { expiresAt });
            if (result) {
                showAlert('成功', '修改成功');
                $('modal-edit-expiry').classList.remove('show');
                loadUsers();
            }
        });
    }
    
    const btnCancelExpiry = $('btn-cancel-expiry');
    if (btnCancelExpiry) {
        btnCancelExpiry.addEventListener('click', () => {
            $('modal-edit-expiry').classList.remove('show');
        });
    }
});
