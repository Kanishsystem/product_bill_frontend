import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UnitService } from '../../../core/services/unit.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { Unit } from '../../../core/models/unit.model';

@Component({
  selector: 'app-unit-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './unit-form.html',
  styleUrl: './unit-form.scss',
})
export class UnitForm implements OnInit {
  unitId: number | null = null;
  loading = signal(false);
  saving = signal(false);

  form = { unit_name: '' };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private unitService: UnitService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.unitId = Number(idParam);
      this.load();
    }
  }

  load(): void {
    if (!this.unitId) return;
    this.loading.set(true);
    this.unitService.get(this.unitId).subscribe({
      next: (res) => {
        const unit = res.data as Unit;
        this.form = { unit_name: unit.unit_name };
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load this unit.'));
      },
    });
  }

  save(): void {
    if (!this.form.unit_name.trim()) {
      this.toast.error('Unit name is required.');
      return;
    }
    this.saving.set(true);

    const payload = { unit_name: this.form.unit_name.trim() };
    const request = this.unitId
      ? this.unitService.update(this.unitId, payload)
      : this.unitService.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.unitId ? 'Unit updated.' : 'Unit created.');
        this.router.navigate(['/units']);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not save this unit.'));
      },
    });
  }
}
