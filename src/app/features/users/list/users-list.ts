import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { User } from '../../../core/models/user.model';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [FormsModule, RouterLink, Icon, EmptyState],
  templateUrl: './users-list.html',
  styleUrl: './users-list.scss',
})
export class UsersList implements OnInit {
  users = signal<User[]>([]);
  loading = signal(true);
  search = '';

  constructor(
    private userService: UserService,
    public auth: AuthService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.userService.list({ search: this.search || undefined }).subscribe({
      next: (res) => {
        this.users.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load users.'));
      },
    });
  }

  isSelf(user: User): boolean {
    return this.auth.currentUser()?.id === user.id;
  }

  async toggleStatus(user: User): Promise<void> {
    const goingInactive = user.status === 'active';
    const confirmed = await this.toast.confirm({
      title: `${goingInactive ? 'Deactivate' : 'Activate'} "${user.name}"?`,
      danger: goingInactive,
      confirmText: goingInactive ? 'Deactivate' : 'Activate',
    });
    if (!confirmed) return;

    const request = goingInactive ? this.userService.deactivate(user.id) : this.userService.activate(user.id);
    request.subscribe({
      next: () => {
        this.toast.success('Updated.');
        this.load();
      },
      error: (err) => this.toast.error(extractErrorMessage(err, 'Could not update this user.')),
    });
  }
}
