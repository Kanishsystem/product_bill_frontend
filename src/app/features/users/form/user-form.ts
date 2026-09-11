import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { User, UserRole } from '../../../core/models/user.model';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './user-form.html',
  styleUrl: './user-form.scss',
})
export class UserForm implements OnInit {
  userId: number | null = null;
  loading = signal(false);
  saving = signal(false);
  isSelf = signal(false);

  form: {
    name: string;
    email: string;
    username: string;
    password: string;
    role: UserRole;
  } = {
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'cashier',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private auth: AuthService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.userId = Number(idParam);
      this.isSelf.set(this.auth.currentUser()?.id === this.userId);
      this.load();
    }
  }

  load(): void {
    if (!this.userId) return;
    this.loading.set(true);
    this.userService.get(this.userId).subscribe({
      next: (res) => {
        const u = res.data as User;
        this.form = { name: u.name, email: u.email, username: u.username ?? '', password: '', role: u.role };
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load this user.'));
      },
    });
  }

  save(): void {
    if (!this.form.name.trim()) {
      this.toast.error('Name is required.');
      return;
    }
    if (!this.form.email.trim()) {
      this.toast.error('Email is required.');
      return;
    }
    if (!this.userId && this.form.password.length < 6) {
      this.toast.error('Password must be at least 6 characters.');
      return;
    }
    if (this.form.password && this.form.password.length < 6) {
      this.toast.error('Password must be at least 6 characters.');
      return;
    }

    this.saving.set(true);

    const request = this.userId
      ? this.userService.update(this.userId, {
          name: this.form.name.trim(),
          email: this.form.email.trim(),
          username: this.form.username.trim() || undefined,
          role: this.form.role,
          password: this.form.password || undefined,
        })
      : this.userService.create({
          name: this.form.name.trim(),
          email: this.form.email.trim(),
          username: this.form.username.trim() || undefined,
          role: this.form.role,
          password: this.form.password,
        });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.userId ? 'Saved.' : 'User created.');
        this.router.navigate(['/users']);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not save this user.'));
      },
    });
  }
}
