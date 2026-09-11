import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PartyService } from '../../../core/services/party.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { Party, PartyType } from '../../../core/models/party.model';

@Component({
  selector: 'app-party-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './party-form.html',
  styleUrl: './party-form.scss',
})
export class PartyForm implements OnInit {
  partyId: number | null = null;
  loading = signal(false);
  saving = signal(false);

  form: {
    party_type: PartyType;
    name: string;
    phone: string;
    email: string;
    address: string;
    gstin: string;
  } = {
    party_type: 'customer',
    name: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private partyService: PartyService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const typeParam = this.route.snapshot.queryParamMap.get('type') as PartyType | null;
    if (typeParam === 'supplier' || typeParam === 'customer') {
      this.form.party_type = typeParam;
    }
    if (idParam) {
      this.partyId = Number(idParam);
      this.load();
    }
  }

  load(): void {
    if (!this.partyId) return;
    this.loading.set(true);
    this.partyService.get(this.partyId).subscribe({
      next: (res) => {
        const p = res.data as Party;
        this.form = {
          party_type: p.party_type,
          name: p.name,
          phone: p.phone ?? '',
          email: p.email ?? '',
          address: p.address ?? '',
          gstin: p.gstin ?? '',
        };
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load this party.'));
      },
    });
  }

  save(): void {
    if (!this.form.name.trim()) {
      this.toast.error('Name is required.');
      return;
    }
    this.saving.set(true);

    const payload = {
      party_type: this.form.party_type,
      name: this.form.name.trim(),
      phone: this.form.phone.trim() || null,
      email: this.form.email.trim() || null,
      address: this.form.address.trim() || null,
      gstin: this.form.gstin.trim() || null,
    };

    const request = this.partyId ? this.partyService.update(this.partyId, payload) : this.partyService.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.partyId ? 'Saved.' : 'Created.');
        this.router.navigate(['/parties']);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not save this party.'));
      },
    });
  }
}
