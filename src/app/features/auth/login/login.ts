import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { Icon } from '../../../shared/components/icon/icon';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, Icon],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  identifier = '';
  password = '';
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  passwordVisible = signal(false);

  togglePasswordVisible(): void {
    this.passwordVisible.update((v) => !v);
  }

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  async submit(): Promise<void> {
    if (!this.identifier || !this.password) {
      this.errorMessage.set('Enter both username/email and password.');
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.login(this.identifier, this.password);
      this.router.navigate(['/dashboard']);
    } catch (err) {
      this.errorMessage.set(extractErrorMessage(err, 'Invalid username/email or password.'));
    } finally {
      this.loading.set(false);
    }
  }
}
