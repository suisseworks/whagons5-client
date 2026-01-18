export function promptForComment(title: string, message: string): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm';
    overlay.innerHTML = `
      <div class="bg-white rounded-lg shadow-2xl w-[520px] max-w-[90%] border-0 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
        <!-- Header with gradient -->
        <div class="bg-gradient-to-r from-red-600 to-red-700 px-5 py-4 border-b border-red-800/20">
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
              <svg class="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-base font-semibold text-white leading-tight">
                ${title}
              </div>
              <div class="flex items-center gap-2 mt-1.5">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-white/20 text-red-100">
                  Comment Required
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Content -->
        <div class="p-5 bg-white">
          <div class="mb-4">
            <div class="flex items-center gap-2 mb-3">
              <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              <h3 class="text-sm font-semibold text-gray-900">Rejection Reason</h3>
            </div>
            <p class="text-sm text-gray-600 mb-4">${message}</p>
            <div class="rounded-lg border border-gray-200 bg-gray-50/50 p-1 transition-colors focus-within:bg-white focus-within:border-red-300 focus-within:ring-2 focus-within:ring-red-500/20">
              <textarea 
                class="w-full bg-transparent text-gray-900 rounded-md px-3 py-2.5 text-sm focus:outline-none resize-none" 
                rows="4" 
                placeholder="Please provide a reason for rejecting this approval..."
              ></textarea>
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div class="pt-4 mt-4 border-t border-gray-200 flex items-center gap-2.5">
            <button class="wh-modal-cancel flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 active:scale-[0.98] transition-all duration-150 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2">
              <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              Cancel
            </button>
            <button class="wh-modal-ok flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] transition-all duration-150 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
              <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Submit Rejection
            </button>
          </div>
        </div>
      </div>
    `;

    const textarea = overlay.querySelector('textarea') as HTMLTextAreaElement | null;
    const btnCancel = overlay.querySelector('.wh-modal-cancel') as HTMLButtonElement | null;
    const btnOk = overlay.querySelector('.wh-modal-ok') as HTMLButtonElement | null;

    const cleanup = () => {
      overlay.classList.add('animate-out', 'fade-out-0', 'zoom-out-95');
      setTimeout(() => overlay.remove(), 200);
    };

    btnCancel?.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });
    btnOk?.addEventListener('click', () => {
      const val = textarea?.value?.trim() || '';
      if (!val) {
        // Add shake animation for validation feedback
        textarea?.parentElement?.classList.add('animate-shake');
        textarea?.focus?.();
        setTimeout(() => {
          textarea?.parentElement?.classList.remove('animate-shake');
        }, 500);
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

    // Handle Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
        resolve(null);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    document.body.appendChild(overlay);
    textarea?.focus();
  });
}

