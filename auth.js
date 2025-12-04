/**
 * Authentication Module
 * Handles password modal and authentication flow
 */

class AuthManager {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Check if user is authenticated, show password modal if not
   */
  async ensureAuthenticated() {
    if (this.apiClient.isAuthenticated()) {
      return true;
    }

    return await this.showPasswordModal();
  }

  /**
   * Show password modal and wait for authentication
   */
  showPasswordModal() {
    return new Promise((resolve) => {
      const modal = document.getElementById('password-modal');
      const input = document.getElementById('password-input');
      const errorDiv = document.getElementById('password-error');

      // Clear previous state
      input.value = '';
      errorDiv.textContent = '';
      errorDiv.style.display = 'none';

      // Show modal
      modal.style.display = 'flex';

      // Focus input
      setTimeout(() => input.focus(), 100);

      // Handle form submit
      const form = modal.querySelector('.password-form');
      const submitHandler = async (e) => {
        e.preventDefault();

        const password = input.value.trim();
        if (!password) {
          this.showError('Please enter a password');
          return;
        }

        try {
          await this.apiClient.authenticate(password);

          // Success - hide modal
          modal.style.display = 'none';
          form.removeEventListener('submit', submitHandler);
          resolve(true);
        } catch (error) {
          this.showError(error.message || 'Invalid password');
          input.value = '';
          input.focus();
        }
      };

      form.addEventListener('submit', submitHandler);
    });
  }

  /**
   * Show error message in password modal
   */
  showError(message) {
    const errorDiv = document.getElementById('password-error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }

  /**
   * Logout and show password modal again
   */
  async logout() {
    this.apiClient.logout();
    await this.showPasswordModal();
  }

  /**
   * Handle auth errors (e.g., expired token)
   * Show password modal to re-authenticate
   */
  async handleAuthError() {
    return await this.showPasswordModal();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AuthManager };
}
