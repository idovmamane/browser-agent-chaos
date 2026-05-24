import type { CategoryChallenge } from './_shared';

/**
 * Accessibility family — pages that look fine to a sighted skim but mislead an
 * agent that relies on visible affordances alone. Each scenario rewards
 * agents that read aria-*, tooltips, label text, and structural cues instead
 * of clicking the most visually obvious button.
 */
export const familyAccessibility: CategoryChallenge[] = [
  {
    id: 'hidden-label',
    title: 'Hidden Label',
    tagline: 'Two unlabeled inputs, only one is the email field.',
    goal: 'Submit the newsletter signup using the email field, not the coupon code field.',
    rules: [
      'Identify the correct input via its aria-label, not visible placement.',
      'Submit only after the email field is targeted.',
    ],
    traps: [
      'Neither input has a visible <label>; both are bare boxes.',
      'The coupon form looks more prominent than the newsletter form.',
    ],
    category: 'accessibility',
    template: 'a11y-form',
    difficulty: 'medium',
    estimatedSeconds: 30,
    actionSpec: {
      prompt: 'Sign up for the newsletter.',
      correct: {
        id: 'newsletter-submit',
        label: 'Subscribe',
        successMessage: 'Subscribed — you used the correctly labeled email field.',
      },
      others: [
        {
          id: 'coupon-submit',
          label: 'Apply code',
          description: 'Submits the coupon field, not the newsletter form.',
          kind: 'wrong',
        },
        {
          id: 'newsletter-clear',
          label: 'Clear',
          description: 'Wipes the newsletter input without submitting.',
          kind: 'wrong',
        },
        {
          id: 'coupon-clear',
          label: 'Reset',
          description: 'Resets the coupon form.',
          kind: 'wrong',
        },
      ],
    },
    templateData: {
      productName: 'Lumen Mail',
      headline: 'Stay in the loop',
      body: 'Drop your email below for product updates. Two inputs are visible — only one is wired to the newsletter.',
      a11yKind: 'hidden-label',
    },
  },
  {
    id: 'low-contrast-button',
    title: 'Low-Contrast Submit',
    tagline: 'The real save button is barely visible; a bright decoy does nothing.',
    goal: 'Save the account settings using the real submit control.',
    rules: [
      'Use the functional submit button, not the visually loud decoy.',
      'Do not navigate away before saving.',
    ],
    traps: [
      'The actual Save button is light-gray text on white — almost invisible.',
      'A vivid orange "Submit" button is wired to nothing.',
    ],
    category: 'accessibility',
    template: 'a11y-form',
    difficulty: 'medium',
    estimatedSeconds: 35,
    actionSpec: {
      prompt: 'Save the account settings.',
      correct: {
        id: 'settings-save',
        label: 'Save',
        successMessage: 'Settings saved via the real (low-contrast) Save control.',
      },
      others: [
        {
          id: 'decoy-submit',
          label: 'Submit',
          description: 'Bright orange button that is not wired to the form.',
          kind: 'wrong',
        },
        {
          id: 'settings-cancel',
          label: 'Cancel',
          description: 'Discards any pending changes.',
          kind: 'wrong',
        },
        {
          id: 'settings-back',
          label: 'Back to dashboard',
          description: 'Leaves the settings page without saving.',
          kind: 'wrong',
        },
      ],
    },
    templateData: {
      productName: 'Halcyon Workspace',
      headline: 'Account settings',
      body: 'Update your display name and notification preferences, then save.',
      a11yKind: 'low-contrast',
      decoyButtonText: 'Submit',
    },
  },
  {
    id: 'icon-only-button',
    title: 'Icon-Only Toolbar',
    tagline: 'Four emoji buttons — only one is Share.',
    goal: 'Share the document from the toolbar.',
    rules: [
      'Identify the Share action via tooltip / aria-label, not icon guess.',
      'Do not delete or export the document.',
    ],
    traps: [
      'No visible text labels — just emoji glyphs.',
      'Tooltips reveal the real action behind each icon.',
    ],
    category: 'accessibility',
    template: 'a11y-form',
    difficulty: 'medium',
    estimatedSeconds: 30,
    actionSpec: {
      prompt: 'Share the document.',
      correct: {
        id: 'icon-share',
        label: 'Share',
        successMessage: 'Document shared via the correctly tooltipped icon.',
      },
      others: [
        {
          id: 'icon-export',
          label: 'Export',
          description: 'Downloads a PDF copy instead of sharing.',
          kind: 'wrong',
        },
        {
          id: 'icon-delete',
          label: 'Delete',
          description: 'Trashes the document.',
          kind: 'wrong',
          fail: true,
        },
        {
          id: 'icon-settings',
          label: 'Settings',
          description: 'Opens the document settings panel.',
          kind: 'wrong',
        },
      ],
    },
    templateData: {
      productName: 'Quillpad',
      headline: 'Untitled draft',
      body: 'Use the toolbar above the editor to share this document with a teammate.',
      a11yKind: 'icon-only',
      icons: ['📤', '🗑', '⚙️', '🔗'],
    },
  },
  {
    id: 'aria-expanded-mismatch',
    title: 'aria-expanded Lies',
    tagline: 'The accordion says it is open, but the panel is collapsed.',
    goal: 'Open the "Shipping details" section so its content is visible.',
    rules: [
      'Trust the visible state, not the stale aria-expanded attribute.',
      'A second click is required to actually expand the panel.',
    ],
    traps: [
      'aria-expanded="true" is set even though the panel content is hidden.',
      'A nearby section is genuinely open and might look like the goal.',
    ],
    category: 'accessibility',
    template: 'a11y-form',
    difficulty: 'medium',
    estimatedSeconds: 35,
    actionSpec: {
      prompt: 'Open the Shipping details section.',
      correct: {
        id: 'shipping-toggle',
        label: 'Open section',
        successMessage: 'Shipping details now actually expanded.',
      },
      others: [
        {
          id: 'returns-toggle',
          label: 'Open Returns',
          description: 'Expands a different, irrelevant section.',
          kind: 'wrong',
        },
        {
          id: 'shipping-close',
          label: 'Close section',
          description: 'Re-collapses the stale-marked panel without ever showing it.',
          kind: 'wrong',
        },
        {
          id: 'page-continue',
          label: 'Continue to checkout',
          description: 'Skips past the section entirely.',
          kind: 'wrong',
        },
      ],
    },
    templateData: {
      productName: 'Foldpost FAQ',
      headline: 'Order help',
      body: 'Expand the Shipping details section to see carrier ETAs.',
      a11yKind: 'aria-expanded-mismatch',
    },
  },
  {
    id: 'screen-reader-only',
    title: 'Screen-Reader-Only CTA',
    tagline: 'The only working button is visually hidden.',
    goal: 'Skip to the main content using the screen-reader-only link.',
    rules: [
      'Use the visually-hidden but DOM-present Skip-to-content control.',
      'Do not click decorative buttons that look interactive.',
    ],
    traps: [
      'The visible "Get started" button is a styled div with no handler.',
      'The real anchor is a sr-only element placed before the nav.',
    ],
    category: 'accessibility',
    template: 'a11y-form',
    difficulty: 'medium',
    estimatedSeconds: 35,
    actionSpec: {
      prompt: 'Skip to the main content.',
      correct: {
        id: 'sr-skip',
        label: 'Continue',
        successMessage: 'Skipped to main content via the sr-only link.',
      },
      others: [
        {
          id: 'fake-cta',
          label: 'Get started',
          description: 'A styled div masquerading as a button — does nothing.',
          kind: 'wrong',
        },
        {
          id: 'nav-home',
          label: 'Home',
          description: 'Navigates back to the marketing home page.',
          kind: 'wrong',
        },
        {
          id: 'nav-pricing',
          label: 'Pricing',
          description: 'Moves to the pricing page instead of the main content.',
          kind: 'wrong',
        },
      ],
    },
    templateData: {
      productName: 'Riftline Docs',
      headline: 'Documentation',
      body: 'Jump past the navigation chrome to the article body.',
      a11yKind: 'sr-only',
    },
  },
  {
    id: 'focus-outline-removed',
    title: 'No Focus Ring',
    tagline: 'Tab-only flow; submit requires Enter after focus moves.',
    goal: 'Submit the support ticket form via keyboard.',
    rules: [
      'Move focus with Tab and confirm with Enter on the submit control.',
      'Do not rely on a visible focus outline — it has been removed.',
    ],
    traps: [
      'CSS sets outline: none globally — focus is invisible.',
      'A mouse click on the submit button is intercepted and ignored.',
    ],
    category: 'accessibility',
    template: 'a11y-form',
    difficulty: 'medium',
    estimatedSeconds: 40,
    actionSpec: {
      prompt: 'Submit the support ticket.',
      correct: {
        id: 'ticket-submit',
        label: 'Submit',
        successMessage: 'Ticket submitted via keyboard Enter after tabbing.',
      },
      others: [
        {
          id: 'ticket-cancel',
          label: 'Cancel',
          description: 'Discards the ticket without sending it.',
          kind: 'wrong',
        },
        {
          id: 'ticket-save-draft',
          label: 'Save draft',
          description: 'Stores the ticket as a draft rather than submitting.',
          kind: 'wrong',
        },
        {
          id: 'ticket-attach',
          label: 'Attach file',
          description: 'Opens a file picker instead of completing the form.',
          kind: 'wrong',
        },
      ],
    },
    templateData: {
      productName: 'Beacon Support',
      headline: 'Open a ticket',
      body: 'Describe the issue and submit. Mouse clicks on Submit are blocked — use the keyboard.',
      a11yKind: 'no-focus-ring',
    },
  },
  {
    id: 'toggle-pretender',
    title: 'Toggle That Looks Like a Button',
    tagline: 'iOS-style switch styled like a CTA — flip it ON.',
    goal: 'Enable two-factor authentication by toggling the switch ON.',
    rules: [
      'Treat the rounded pill as a switch, not a button.',
      'The toggle must end in the ON (true) state.',
    ],
    traps: [
      'The switch is styled to look like a primary button.',
      'A separate "Enable" button nearby does not actually enable 2FA.',
    ],
    category: 'accessibility',
    template: 'a11y-form',
    difficulty: 'medium',
    estimatedSeconds: 30,
    actionSpec: {
      prompt: 'Turn on two-factor authentication.',
      correct: {
        id: 'twofa-toggle',
        label: 'Save',
        successMessage: 'Two-factor authentication toggled ON.',
      },
      others: [
        {
          id: 'twofa-fake-enable',
          label: 'Enable',
          description: 'A decoy button that does not flip the switch.',
          kind: 'wrong',
        },
        {
          id: 'twofa-learn-more',
          label: 'Learn more',
          description: 'Opens an explainer drawer without enabling anything.',
          kind: 'wrong',
        },
        {
          id: 'twofa-skip-step',
          label: 'Continue',
          description: 'Skips the security step without enabling 2FA.',
          kind: 'wrong',
        },
      ],
    },
    templateData: {
      productName: 'Vaultmark',
      headline: 'Secure your account',
      body: 'Two-factor authentication is currently OFF. Flip the switch to turn it on.',
      a11yKind: 'toggle-pretender',
    },
  },
  {
    id: 'language-attr',
    title: 'Lang Attribute Lies',
    tagline: 'Page declares lang="fr" but every word is English.',
    goal: 'Continue the onboarding flow by clicking the English CTA the user actually sees.',
    rules: [
      'Follow visible, human-readable text — not the document lang attribute.',
      'Do not click anything labeled as a French translation.',
    ],
    traps: [
      'document.documentElement.lang === "fr" despite English copy.',
      'A small button labeled "Suivant" is a decoy that aborts onboarding.',
    ],
    category: 'accessibility',
    template: 'a11y-form',
    difficulty: 'medium',
    estimatedSeconds: 30,
    actionSpec: {
      prompt: 'Continue with onboarding.',
      correct: {
        id: 'onboard-continue',
        label: 'Continue',
        successMessage: 'Continued onboarding using the visible English CTA.',
      },
      others: [
        {
          id: 'onboard-suivant',
          label: 'Suivant',
          description: 'A French-labeled decoy that aborts onboarding.',
          kind: 'wrong',
        },
        {
          id: 'onboard-back',
          label: 'Back',
          description: 'Returns to the previous step.',
          kind: 'wrong',
        },
        {
          id: 'onboard-exit',
          label: 'Exit setup',
          description: 'Quits the onboarding flow entirely.',
          kind: 'wrong',
        },
      ],
    },
    templateData: {
      productName: 'Northwind Onboarding',
      headline: 'Welcome aboard',
      body: 'Confirm your details and continue. The page reports its language as French even though the copy is English.',
      a11yKind: 'lang-attr-lies',
      declaredLang: 'fr',
    },
  },
  {
    id: 'heading-order',
    title: 'Two H1s, Wrong One First',
    tagline: 'Two H1 elements — the second is the actual page title.',
    goal: 'Submit the form belonging to the real (second) page title, not the leftover banner H1.',
    rules: [
      'Use heading structure cues to identify the real page section.',
      'Submit the form under the second H1, not the marketing banner.',
    ],
    traps: [
      'A promotional banner is mis-coded as H1, making it look like the title.',
      'The actual page H1 sits lower and owns the real form.',
    ],
    category: 'accessibility',
    template: 'a11y-form',
    difficulty: 'medium',
    estimatedSeconds: 40,
    actionSpec: {
      prompt: 'Update your profile.',
      correct: {
        id: 'profile-submit',
        label: 'Save',
        successMessage: 'Profile saved under the real page heading.',
      },
      others: [
        {
          id: 'banner-cta',
          label: 'Claim offer',
          description: 'CTA tied to the misplaced banner H1.',
          kind: 'wrong',
        },
        {
          id: 'profile-cancel',
          label: 'Cancel',
          description: 'Discards profile edits.',
          kind: 'wrong',
        },
        {
          id: 'banner-dismiss',
          label: 'Dismiss banner',
          description: 'Hides the promo banner without saving the profile.',
          kind: 'wrong',
        },
      ],
    },
    templateData: {
      productName: 'Trailhead Profiles',
      headline: 'Edit profile',
      body: 'The promo banner is incorrectly coded as an H1. The real page title is the second H1.',
      a11yKind: 'heading-order',
      headings: [
        { level: 1, text: 'Spring sale — 30% off Pro', isPageTitle: false },
        { level: 1, text: 'Edit profile', isPageTitle: true },
        { level: 2, text: 'Personal details' },
      ],
    },
  },
];

export default familyAccessibility;
