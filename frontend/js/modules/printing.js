/**
 * Printing Module
 * Custom printable item entry with description and price.
 */

const Printing = (() => {
  const STORAGE_KEY = 'printing_templates';
  let savedTemplates = [];
  let editingTemplateId = null;

  const render = async () => {
    document.getElementById('app').innerHTML = `
<div class="main-layout">
  ${renderSidebar('printing')}
  <div class="content-area">
    ${renderTopbar('Printing')}
    <div class="page-content page">
      <div class="card" style="max-width:640px;margin:auto;">
        <div class="card-header"><span class="card-title">🖨 Custom Print</span></div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-textarea" id="print-description" rows="5" placeholder="Enter item description..." oninput="Printing.updatePreview()"></textarea>
          </div>
          <div class="form-group" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end;">
            <div>
              <label class="form-label">Price (₱)</label>
              <input type="number" class="form-input" id="print-price" placeholder="0.00" min="0" step="0.01" oninput="Printing.updatePreview()">
            </div>
            <div>
              <label class="form-label">Quantity</label>
              <input type="number" class="form-input" id="print-quantity" placeholder="1" min="1" step="1" value="1" oninput="Printing.updatePreview()">
            </div>
          </div>
          <div id="print-error" class="form-error hidden"></div>
          <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:8px;">
            <button class="btn btn-secondary" onclick="Printing.saveTemplate()" id="print-save-btn">Save</button>
            <button class="btn btn-danger hidden" onclick="Printing.deleteTemplate()" id="print-delete-btn">Delete</button>
            <button class="btn btn-ghost" onclick="Printing.clearForm()">Clear</button>
            <button class="btn btn-primary" onclick="Printing.print()">Print</button>
          </div>
          <div class="card" style="padding:16px;border:1px solid var(--c-border);margin-top:18px;">
            <div class="text-sm text-muted mb-sm">Preview</div>
            <div id="printing-preview-content" style="white-space:pre-wrap;min-height:100px;color:var(--c-text);"></div>
            <div id="printing-preview-price" class="text-end fw-bold mt-sm"></div>
          </div>
          <div class="card" style="padding:16px;border:1px solid var(--c-border);margin-top:18px;">
            <div class="text-sm text-muted mb-sm">Saved Templates</div>
            <div id="print-saved-list"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;

    loadSavedTemplates();
    updateTemplateMode();
    updatePreview();
  };

  const loadSavedTemplates = () => {
    savedTemplates = Storage.get(STORAGE_KEY) || [];
    if (!Array.isArray(savedTemplates)) savedTemplates = [];
    renderSavedTemplates();
  };

  const renderSavedTemplates = () => {
    const listEl = document.getElementById('print-saved-list');
    if (!listEl) return;

    if (!savedTemplates.length) {
      listEl.innerHTML = '<p class="text-sm text-muted">No saved templates yet.</p>';
      return;
    }

    listEl.innerHTML = savedTemplates.map(item => `
      <div style="display:grid;grid-template-columns:1fr auto;gap:12px;padding:10px 0;border-bottom:1px solid var(--c-border);align-items:center;">
        <button class="btn btn-ghost btn-block" style="text-align:left;min-width:0;" onclick="Printing.editTemplate('${item.id}')">
          <div class="fw-semibold">${escapeHTML((item.description || '').split('\n')[0] || 'Untitled')}</div>
          <div class="text-sm text-muted">₱${item.price.toFixed(2)} × ${item.quantity} = ₱${(item.price * item.quantity).toFixed(2)}</div>
        </button>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-secondary btn-sm" onclick="Printing.editTemplate('${item.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="Printing.deleteTemplate('${item.id}')">Delete</button>
        </div>
      </div>`).join('');
  };

  const updateTemplateMode = () => {
    const saveBtn = document.getElementById('print-save-btn');
    const deleteBtn = document.getElementById('print-delete-btn');
    if (!saveBtn || !deleteBtn) return;

    if (editingTemplateId) {
      saveBtn.textContent = 'Update';
      deleteBtn.classList.remove('hidden');
    } else {
      saveBtn.textContent = 'Save';
      deleteBtn.classList.add('hidden');
    }
  };

  const getFormValues = () => {
    return {
      description: document.getElementById('print-description')?.value.trim() || '',
      price: parseFloat(document.getElementById('print-price')?.value) || 0,
      quantity: parseInt(document.getElementById('print-quantity')?.value, 10) || 1,
    };
  };

  const validateForm = (description, price) => {
    const errEl = document.getElementById('print-error');
    errEl.classList.add('hidden');

    if (!description) {
      errEl.textContent = 'Description is required.';
      errEl.classList.remove('hidden');
      return false;
    }

    if (isNaN(price) || price < 0) {
      errEl.textContent = 'Enter a valid price.';
      errEl.classList.remove('hidden');
      return false;
    }

    return true;
  };

  const saveTemplate = () => {
    const { description, price, quantity } = getFormValues();
    if (!validateForm(description, price)) return;

    if (editingTemplateId) {
      const existingIndex = savedTemplates.findIndex(t => t.id === editingTemplateId);
      if (existingIndex >= 0) {
        savedTemplates[existingIndex] = { id: editingTemplateId, description, price, quantity, updatedAt: new Date().toISOString() };
        Toast.show('Template updated.', 'success');
      }
    } else {
      savedTemplates.unshift({ id: `template_${Date.now()}`, description, price, quantity, createdAt: new Date().toISOString() });
      Toast.show('Template saved.', 'success');
    }

    Storage.set(STORAGE_KEY, savedTemplates);
    renderSavedTemplates();
    clearForm();
  };

  const editTemplate = (templateId) => {
    const template = savedTemplates.find(t => t.id === templateId);
    if (!template) return;

    editingTemplateId = templateId;
    document.getElementById('print-description').value = template.description;
    document.getElementById('print-price').value = template.price;
    document.getElementById('print-quantity').value = template.quantity;
    document.getElementById('print-error').classList.add('hidden');
    updateTemplateMode();
    updatePreview();
  };

  const deleteTemplate = (templateId = '') => {
    const idToDelete = templateId || editingTemplateId;
    if (!idToDelete) return;

    const template = savedTemplates.find(t => t.id === idToDelete);
    if (!template) return;
    if (!confirm(`Delete saved template?`)) return;

    savedTemplates = savedTemplates.filter(t => t.id !== idToDelete);
    Storage.set(STORAGE_KEY, savedTemplates);
    Toast.show('Template deleted.', 'success');

    if (editingTemplateId === idToDelete) {
      clearForm();
    } else {
      renderSavedTemplates();
    }
  };

  const updatePreview = () => {
    const { description, price, quantity } = getFormValues();
    const contentEl = document.getElementById('printing-preview-content');
    const priceEl = document.getElementById('printing-preview-price');

    if (contentEl) {
      contentEl.textContent = description || 'No description entered yet.';
    }
    if (priceEl) {
      priceEl.textContent = `Price: ₱${price.toFixed(2)} × ${quantity} = ₱${(price * quantity).toFixed(2)}`;
    }
  };

  const clearForm = () => {
    editingTemplateId = null;
    document.getElementById('print-description').value = '';
    document.getElementById('print-price').value = '';
    document.getElementById('print-quantity').value = '1';
    document.getElementById('print-error').classList.add('hidden');
    updateTemplateMode();
    updatePreview();
  };

  const print = () => {
    const { description, price, quantity } = getFormValues();
    const errEl = document.getElementById('print-error');

    if (!validateForm(description, price)) return;

    const total = price * quantity;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Print Item</title>
      <style>
        body{font-family:system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#111; padding:24px;}
        .receipt{max-width:420px;margin:0 auto;border:1px solid #dedede;padding:24px;border-radius:16px;}
        .receipt h1{font-size:1.25rem;margin-bottom:18px;}
        .line{display:flex;justify-content:space-between;margin:12px 0;}
        .label{color:#555;}
        .total{font-weight:700;border-top:1px solid #ddd;padding-top:14px;margin-top:14px;}
      </style>
    </head><body>
      <div class="receipt">
        <h1>Print Item</h1>
        <div class="line"><span class="label">Description</span><span>${escapeHTML(description)}</span></div>
        <div class="line"><span class="label">Price</span><span>₱${price.toFixed(2)}</span></div>
        <div class="line"><span class="label">Quantity</span><span>${quantity}</span></div>
        <div class="line total"><span>Total</span><span>₱${total.toFixed(2)}</span></div>
      </div>
    </body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      Toast.show('Unable to initialize print frame.', 'error');
      iframe.remove();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
      try {
        iframe.contentWindow.print();
      } catch (printErr) {
        Toast.show('Print failed: ' + printErr.message, 'error');
      }
      iframe.remove();
    }, 300);
  };

  return { render, updatePreview, clearForm, print, saveTemplate, editTemplate, deleteTemplate };
})();
