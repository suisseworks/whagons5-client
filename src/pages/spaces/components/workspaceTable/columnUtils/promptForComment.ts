export function promptForComment(title: string, message: string): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/40';
    overlay.innerHTML = `
      <div class="bg-card text-card-foreground rounded-lg shadow-xl w-[360px] max-w-[90%] border border-border">
        <div class="px-4 py-3 border-b border-border">
          <h3 class="text-sm font-semibold">${title}</h3>
          <p class="text-xs text-muted-foreground mt-1">${message}</p>
        </div>
        <div class="p-4 space-y-3">
          <textarea class="w-full border border-input bg-background text-foreground rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring" rows="3" placeholder="Enter your comment"></textarea>
        </div>
        <div class="px-4 pb-4 flex justify-end gap-2">
          <button class="wh-modal-cancel px-3 py-1.5 text-sm border border-border rounded-md text-foreground bg-background hover:bg-muted">Cancel</button>
          <button class="wh-modal-ok px-3 py-1.5 text-sm border border-border rounded-md text-primary-foreground bg-primary hover:opacity-90">Submit</button>
        </div>
      </div>
    `;

    const textarea = overlay.querySelector('textarea') as HTMLTextAreaElement | null;
    const btnCancel = overlay.querySelector('.wh-modal-cancel') as HTMLButtonElement | null;
    const btnOk = overlay.querySelector('.wh-modal-ok') as HTMLButtonElement | null;

    const cleanup = () => overlay.remove();

    btnCancel?.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });
    btnOk?.addEventListener('click', () => {
      const val = textarea?.value?.trim() || '';
      if (!val) {
        (textarea as any)?.focus?.();
        return;
      }
      cleanup();
      resolve(val);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(null);
      }
    });

    document.body.appendChild(overlay);
    textarea?.focus();
  });
}

