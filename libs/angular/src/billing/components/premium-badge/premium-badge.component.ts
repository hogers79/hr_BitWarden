import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";

import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { BitIconButtonComponent, ChipActionComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { NotPremiumDirective } from "../../directives/not-premium.directive";

@Component({
  selector: "app-premium-badge",
  // Fork patch: no premium upsell badge.
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [I18nPipe, BitIconButtonComponent, ChipActionComponent, NotPremiumDirective],
})
export class PremiumBadgeComponent {
  readonly organizationId = input<string>();
  protected readonly iconOnly = input<boolean>(false);
  private readonly premiumUpgradePromptService = inject(PremiumUpgradePromptService);

  async promptForPremium(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    await this.premiumUpgradePromptService.promptForPremium(this.organizationId());
  }
}
