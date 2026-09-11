import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UnitService } from '../../../core/services/unit.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { Unit } from '../../../core/models/unit.model';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

@Component({
  selector: 'app-units-list',
  standalone: true,
  imports: [RouterLink, Icon, EmptyState],
  templateUrl: './units-list.html',
  styleUrl: './units-list.scss',
})
export class UnitsList implements OnInit {
  units = signal<Unit[]>([]);
  loading = signal(true);

  constructor(
    private unitService: UnitService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.unitService.list().subscribe({
      next: (res) => {
        this.units.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load units.'));
      },
    });
  }

  async remove(unit: Unit): Promise<void> {
    const confirmed = await this.toast.confirm({
      title: `Delete "${unit.unit_name}"?`,
      text: 'Units with products linked to them cannot be deleted.',
      danger: true,
      confirmText: 'Delete',
    });
    if (!confirmed) {
      return;
    }
    this.unitService.delete(unit.id).subscribe({
      next: () => {
        this.toast.success('Unit deleted.');
        this.load();
      },
      error: (err) => this.toast.error(extractErrorMessage(err, 'Could not delete this unit.')),
    });
  }
}
