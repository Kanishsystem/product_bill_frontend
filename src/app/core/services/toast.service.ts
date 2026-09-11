import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

/**
 * Thin wrapper around sweetalert2 so every screen shows toasts/confirm
 * dialogs the same way, styled to match the app's design system.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  success(message: string): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: message,
      showConfirmButton: false,
      timer: 2500,
      timerProgressBar: true,
      customClass: { popup: 'app-toast' },
    });
  }

  error(message: string): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'error',
      title: message,
      showConfirmButton: false,
      timer: 3500,
      timerProgressBar: true,
      customClass: { popup: 'app-toast' },
    });
  }

  async confirm(options: { title: string; text?: string; confirmText?: string; danger?: boolean }): Promise<boolean> {
    const result = await Swal.fire({
      title: options.title,
      text: options.text,
      icon: options.danger ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonText: options.confirmText ?? 'Yes',
      cancelButtonText: 'Cancel',
      confirmButtonColor: options.danger ? '#c0392b' : '#e8296b',
    });
    return result.isConfirmed;
  }
}
