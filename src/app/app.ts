import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CompanyService } from './core/services/company.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('product_bill_frontend');

  constructor(
    private theme: ThemeService,
    private companyService: CompanyService,
  ) {
    // Paint the last-known color immediately (before the API call below
    // resolves), then fetch the shop's actual saved color. On the login
    // screen (not authenticated yet) this call 401s - that's fine, it just
    // means the default/cached color is shown until the user signs in.
    this.theme.applyCachedTheme();
    this.companyService.get().subscribe({
      next: (res) => this.theme.setTheme(res.data?.theme_color),
      error: () => {
        /* not logged in yet, or no profile row - keep the cached/default color */
      },
    });
  }
}
