let selectedCards = new Set();

async function loadCards() {
    const container = $('cards-list');
    if (!container) return;
    container.innerHTML = '<div class="loading">加载中...</div>';
    selectedCards.clear();
    updateBatchDeleteButton();
    
    try {
        const result = await api('/api/admin/cards');
        const cards = result.data || result || [];
        if (!cards || !cards.length) {
            container.innerHTML = '<div class="empty">暂无卡密</div>';
            return;
        }
        container.innerHTML = cards.map(card => {
            const status = card.enabled ? '启用' : '禁用';
            const statusClass = card.enabled ? 'status-enabled' : 'status-disabled';
            const usageStatus = card.usedBy ? `已使用 (${card.usedBy})` : '未使用';
            const usageClass = card.usedBy ? 'used' : 'unused';
            const createdAt = new Date(card.createdAt).toLocaleString();
            const usedAt = card.usedAt ? new Date(card.usedAt).toLocaleString() : '-';
            
            const typeMap = { D: '天卡', W: '周卡', M: '月卡', F: '永久卡' };
            const typeName = typeMap[card.type] || card.type;
            
            return `
            <div class="card-item" data-code="${card.code}">
                <div class="card-select">
                    <input type="checkbox" class="card-checkbox" data-code="${card.code}" onchange="toggleCardSelection('${card.code}')">
                </div>
                <div class="card-content">
                    <div class="card-header">
                        <div class="card-code-display">
                            <span class="card-code">${escapeHtml(card.code)}</span>
                            <button class="btn btn-xs btn-copy" onclick="copyCardCode('${card.code}')" title="复制卡密">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        <span class="card-status ${statusClass}">${status}</span>
                    </div>
                    <div class="card-info">
                        <div class="card-info-row">
                            <span class="label">描述:</span>
                            <span class="value">${escapeHtml(card.description || '-')}</span>
                        </div>
                        <div class="card-info-row">
                            <span class="label">类型:</span>
                            <span class="value">${typeName} (${card.days}天)</span>
                        </div>
                        <div class="card-info-row">
                            <span class="label">使用状态:</span>
                            <span class="value ${usageClass}">${usageStatus}</span>
                        </div>
                        <div class="card-info-row">
                            <span class="label">创建时间:</span>
                            <span class="value">${createdAt}</span>
                        </div>
                        <div class="card-info-row">
                            <span class="label">使用时间:</span>
                            <span class="value">${usedAt}</span>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-sm" onclick="editCard('${card.code}')">编辑</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteCardConfirm('${card.code}')">删除</button>
                    </div>
                </div>
            </div>
        `}).join('');
    } catch (e) {
        console.error('加载卡密失败:', e);
        container.innerHTML = '<div class="error">加载失败，请查看控制台</div>';
    }
}

window.toggleCardSelection = (code) => {
    const checkbox = document.querySelector(`.card-checkbox[data-code="${code}"]`);
    if (checkbox.checked) {
        selectedCards.add(code);
    } else {
        selectedCards.delete(code);
    }
    updateBatchDeleteButton();
};

function updateBatchDeleteButton() {
    const btn = $('btn-batch-delete-cards');
    if (btn) {
        if (selectedCards.size > 0) {
            btn.style.display = 'inline-flex';
            btn.innerHTML = `<i class="fas fa-trash"></i> 批量删除 (${selectedCards.size})`;
        } else {
            btn.style.display = 'none';
        }
    }
}

window.batchDeleteCards = async () => {
    if (selectedCards.size === 0) return;
    
    const codes = Array.from(selectedCards);
    showConfirm(
        '批量删除卡密',
        `确定要删除选中的 ${codes.length} 个卡密吗？\n\n⚠️ 警告：此操作不可恢复！`,
        async () => {
            try {
                const result = await api('/api/admin/cards/batch-delete', 'POST', { codes });
                if (result && result.ok) {
                    const { deleted, failed } = result.data || {};
                    showAlert('成功', `成功删除 ${deleted} 个卡密${failed > 0 ? `，失败 ${failed} 个` : ''}`);
                    selectedCards.clear();
                    loadCards();
                } else {
                    showAlert('错误', result.error || '删除失败');
                }
            } catch (e) {
                console.error('批量删除卡密失败:', e);
                showAlert('错误', '删除失败: ' + e.message);
            }
        }
    );
};

window.copyCardCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
        showAlert('提示', '卡密已复制到剪贴板');
    }).catch(err => {
        console.error('复制失败:', err);
        showAlert('错误', '复制失败，请手动复制');
    });
};

window.editCard = async (code) => {
    const result = await api('/api/admin/cards');
    const cards = result.data || result || [];
    const card = cards.find(c => c.code === code);
    if (!card) return;
    
    const modal = $('modal-edit-card');
    if (!modal) return;
    
    $('edit-card-code').value = code;
    $('edit-card-desc').value = card.description || '';
    $('edit-card-enabled').value = card.enabled ? 'true' : 'false';
    
    modal.classList.add('show');
};

window.deleteCardConfirm = async (code) => {
    showConfirm('确认删除', `确定要删除卡密 ${code} 吗？`, async () => {
        const result = await api(`/api/admin/cards/${encodeURIComponent(code)}`, 'DELETE');
        if (result !== null) {
            showAlert('成功', '删除成功');
            loadCards();
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    const btnAddCard = $('btn-add-card');
    if (btnAddCard) {
        btnAddCard.addEventListener('click', () => {
            const modal = $('modal-add-card');
            if (modal) modal.classList.add('show');
        });
    }
    
    const btnBatchDelete = $('btn-batch-delete-cards');
    if (btnBatchDelete) {
        btnBatchDelete.addEventListener('click', window.batchDeleteCards);
    }
    
    const btnSaveCard = $('btn-save-card');
    if (btnSaveCard) {
        btnSaveCard.addEventListener('click', async () => {
            const description = $('card-desc').value;
            const type = $('card-type').value;
            const days = $('card-days').value;
            const count = $('card-count').value;
            
            if (!description || !type || !days) {
                showAlert('错误', '请填写完整信息');
                return;
            }
            
            const result = await api('/api/admin/cards', 'POST', { 
                description, 
                type, 
                days: parseInt(days, 10),
                count: parseInt(count, 10) || 1
            });
            if (result) {
                const countNum = parseInt(count, 10) || 1;
                if (countNum > 1 && Array.isArray(result.data)) {
                    const codes = result.data.map(c => c.code).join('\n');
                    showAlert('成功', `成功生成 ${result.data.length} 个卡密`);
                } else {
                    showAlert('成功', `卡密生成成功: ${result.data?.code || result.code}`);
                }
                $('modal-add-card').classList.remove('show');
                $('card-desc').value = '';
                $('card-days').value = '30';
                $('card-count').value = '1';
                loadCards();
            }
        });
    }
    
    const btnCancelCard = $('btn-cancel-card');
    if (btnCancelCard) {
        btnCancelCard.addEventListener('click', () => {
            $('modal-add-card').classList.remove('show');
        });
    }
    
    const btnSaveEditCard = $('btn-save-edit-card');
    if (btnSaveEditCard) {
        btnSaveEditCard.addEventListener('click', async () => {
            const code = $('edit-card-code').value;
            const description = $('edit-card-desc').value;
            const enabled = $('edit-card-enabled').value === 'true';
            
            const result = await api(`/api/admin/cards/${encodeURIComponent(code)}`, 'PUT', { description, enabled });
            if (result !== null) {
                showAlert('成功', '修改成功');
                $('modal-edit-card').classList.remove('show');
                loadCards();
            }
        });
    }
    
    const btnCancelEditCard = $('btn-cancel-edit-card');
    if (btnCancelEditCard) {
        btnCancelEditCard.addEventListener('click', () => {
            $('modal-edit-card').classList.remove('show');
        });
    }
    
    const cardsPage = $('page-cards');
    if (cardsPage) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.classList.contains('active')) {
                    loadCards();
                }
            });
        });
        observer.observe(cardsPage, { attributes: true, attributeFilter: ['class'] });
        
        if (cardsPage.classList.contains('active')) {
            loadCards();
        }
    }
});
