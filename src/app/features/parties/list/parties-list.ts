import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PartyService } from '../../../core/services/party.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { Party, PartyType } from '../../../core/models/party.model';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

@Component({
  selector: 'app-parties-list',
  standalone: true,
  imports: [FormsModule, RouterLink, Icon, EmptyState],
  templateUrl: './parties-list.html',
  styleUrl: './parties-list.scss',
})
export class PartiesList implements OnInit {
  parties = signal<Party[]>([]);
  loading = signal(true);
  activeTab: PartyType = 'customer';
  search = '';

  constructor(
    private partyService: PartyService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  setTab(tab: PartyType): void {
    this.activeTab = tab;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.partyService.list({ party_type: this.activeTab, search: this.search || undefined }).subscribe({
      next: (res) => {
        this.parties.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load parties.'));
      },
    });
  }

  async remove(party: Party): Promise<void> {
    const confirmed = await this.toast.confirm({
      title: `Delete "${party.name}"?`,
      text: 'Parties with purchase/sale history cannot be deleted.',
      danger: true,
      confirmText: 'Delete',
    });
    if (!confirmed) return;

    this.partyService.delete(party.id).subscribe({
      next: () => {
        this.toast.success('Deleted.');
        this.load();
      },
      error: (err) => this.toast.error(extractErrorMessage(err, 'Could not delete this party.')),
    });
  }
}
