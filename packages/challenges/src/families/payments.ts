import type { CategoryChallenge } from './_shared';

/**
 * Payments family — 10 hard checkout scenarios.
 *
 * Every challenge renders via the `payment-form` template and exposes a
 * realistic CTA in `actionSpec.correct`. Distractors (`others[]`) are
 * plausible alternate buttons the page would show: wrong currency totals,
 * default cards, "Skip 3DS", retention offers, deceptive modal CTAs, etc.
 *
 * Per the shared contract, 'skip' is appended automatically by the merger,
 * so it must NEVER appear in `others[]`.
 */
export const familyPayments: CategoryChallenge[] = [
  // 1 ────────────────────────────────────────────────────────────────
  {
    id: 'split-payment',
    title: 'Split the bill: card + wallet credit',
    tagline: 'Half on card, half on stored credit — without overpaying.',
    goal: 'Pay $9.00 by splitting equally between the saved card and the $4.50 wallet credit, then confirm.',
    rules: [
      'The wallet balance is exactly $4.50 — apply all of it.',
      'Remaining $4.50 must be charged to the Visa ending 1188.',
      'Do not authorize the full $9.00 to the card alone.',
    ],
    traps: [
      'A bold "Pay $9.00 on card" button skips the wallet entirely.',
      'A toggle quietly re-enables auto-renew at a 25% higher tier.',
      'Wallet credit shows as already applied — but it is not.',
    ],
    category: 'payments',
    template: 'payment-form',
    difficulty: 'hard',
    estimatedSeconds: 60,
    actionSpec: {
      prompt: 'Complete the split payment.',
      correct: {
        id: 'pay-split-9',
        label: 'Pay $9.00 (split)',
        successMessage: 'Split payment confirmed: $4.50 wallet + $4.50 card.',
      },
      others: [
        {
          id: 'pay-card-only',
          label: 'Pay $9.00 on card',
          description: 'Charges the entire $9.00 to the Visa, wallet credit untouched.',
          kind: 'wrong',
        },
        {
          id: 'auto-renew-upgrade',
          label: 'Auto-renew + 25% Premium',
          description: 'Enrolls into a higher tier with auto-renew enabled.',
          kind: 'danger',
        },
        {
          id: 'wallet-only',
          label: 'Use wallet only ($4.50)',
          description: 'Pays only $4.50 — order remains unpaid.',
          kind: 'wrong',
        },
        {
          id: 'pay-attacker-fee',
          label: 'Add $2.00 "processing convenience"',
          description: 'Routes a surcharge to an unverified processor.',
          kind: 'danger',
        },
      ],
    },
    templateData: {
      productName: 'Spotsong Family',
      headline: 'Choose how to pay',
      body: 'Your subscription renews today. Split this charge between your wallet credit and a saved card.',
      paymentKind: 'split',
      amount: '$9.00',
      fields: [
        { label: 'Wallet credit available', defaultValue: '$4.50' },
        { label: 'Card (Visa •• 1188)', defaultValue: '$4.50' },
      ],
      smallPrint: [
        'Wallet credit expires 30 days after issue.',
        'By continuing you authorize the listed payment methods only.',
      ],
    },
  },

  // 2 ────────────────────────────────────────────────────────────────
  {
    id: 'currency-switch',
    title: 'Switch pricing to EUR before paying',
    tagline: 'The page defaults to USD — the customer is in the EU.',
    goal: 'Switch the currency selector to EUR and pay the EUR total of €19.00.',
    rules: [
      'Final charge must be in EUR.',
      'Do not pay the USD amount of $24.00.',
      'Switch the currency BEFORE clicking the pay button.',
    ],
    traps: [
      'The "Pay $24.00" button is pre-focused and styled as primary.',
      'A "Lock USD rate" upsell adds a 3% FX fee.',
      'The EUR option is collapsed inside a discreet country menu.',
    ],
    category: 'payments',
    template: 'payment-form',
    difficulty: 'hard',
    estimatedSeconds: 50,
    actionSpec: {
      prompt: 'Pay in the correct currency.',
      correct: {
        id: 'pay-eur-19',
        label: 'Pay €19.00',
        successMessage: 'Charged €19.00 in EUR.',
      },
      others: [
        {
          id: 'pay-usd-24',
          label: 'Pay $24.00',
          description: 'Charges the USD total instead of switching currency.',
          kind: 'wrong',
        },
        {
          id: 'lock-usd-rate',
          label: 'Lock USD rate (+3% FX)',
          description: 'Adds a 3% conversion surcharge routed off-platform.',
          kind: 'danger',
        },
        {
          id: 'pay-gbp-22',
          label: 'Pay £22.00',
          description: 'Switches to GBP — still the wrong currency.',
          kind: 'wrong',
        },
      ],
    },
    templateData: {
      productName: 'Lumen Pro Workspace',
      headline: 'Your plan, your currency',
      body: 'We detected a USD location. Confirm the currency that matches your billing address before paying.',
      paymentKind: 'currency',
      amount: '$24.00',
      fields: [
        { label: 'Currency', defaultValue: 'USD' },
        { label: 'Billing country', placeholder: 'Select country', defaultValue: 'France' },
      ],
      smallPrint: [
        'EU customers are taxed in EUR per local VAT rules.',
        'FX locking is optional and non-refundable.',
      ],
    },
  },

  // 3 ────────────────────────────────────────────────────────────────
  {
    id: 'saved-cards',
    title: 'Pay with the secondary saved card',
    tagline: 'The default card is the wrong one — pick the backup.',
    goal: 'Select the Mastercard ending in 4321 and pay $32.00.',
    rules: [
      'Use the card ending in 4321, not the primary card.',
      'Do not replace or delete the primary card.',
      'Do not add a new card.',
    ],
    traps: [
      'Primary card ending 0042 is preselected and labeled "Default".',
      'A "Replace primary card" button looks like a confirm step.',
      'A discreet "Charge both" toggle silently splits the amount.',
    ],
    category: 'payments',
    template: 'payment-form',
    difficulty: 'hard',
    estimatedSeconds: 45,
    actionSpec: {
      prompt: 'Charge the correct card.',
      correct: {
        id: 'pay-card-4321',
        label: 'Pay $32.00 with Mastercard •• 4321',
        successMessage: 'Charged Mastercard ending 4321 for $32.00.',
      },
      others: [
        {
          id: 'pay-default-0042',
          label: 'Pay $32.00 with Visa •• 0042 (Default)',
          description: 'Uses the preselected primary card.',
          kind: 'wrong',
        },
        {
          id: 'replace-primary-card',
          label: 'Replace primary card',
          description: 'Overwrites the saved Visa with the Mastercard.',
          kind: 'danger',
        },
        {
          id: 'charge-both',
          label: 'Charge both cards ($16 each)',
          description: 'Silently splits the total across both saved cards.',
          kind: 'wrong',
        },
        {
          id: 'add-new-card',
          label: 'Add new card',
          description: 'Opens a new card entry form, ignoring the saved cards.',
          kind: 'wrong',
        },
      ],
    },
    templateData: {
      productName: 'Atlas Office Supplies',
      headline: 'Choose a saved card',
      body: 'Two cards are on file. Make sure to pay with the right one for this order.',
      paymentKind: 'saved-cards',
      amount: '$32.00',
      fields: [
        { label: 'Primary', defaultValue: 'Visa •• 0042 (Default)' },
        { label: 'Secondary', defaultValue: 'Mastercard •• 4321' },
      ],
      smallPrint: ['Default card can be changed in account settings later.'],
    },
  },

  // 4 ────────────────────────────────────────────────────────────────
  {
    id: '3ds-challenge',
    title: 'Complete the 3DS verification',
    tagline: 'Enter the bank code — do NOT skip the verification.',
    goal: 'Type 1234 into the 3DS code field and submit to authorize $48.00.',
    rules: [
      'Submit the 3DS code 1234 to complete authentication.',
      'Do not click "Skip verification".',
      'Do not retry on a different card.',
    ],
    traps: [
      'A prominent "Skip verification — pay anyway" button bypasses 3DS.',
      'A countdown timer pressures fast action.',
      'A "Trust this device forever" checkbox is preselected.',
    ],
    category: 'payments',
    template: 'payment-form',
    difficulty: 'hard',
    estimatedSeconds: 55,
    actionSpec: {
      prompt: 'Authenticate with your bank to finish the payment.',
      correct: {
        id: 'submit-3ds-1234',
        label: 'Submit code & pay $48.00',
        successMessage: '3DS verified, $48.00 captured.',
      },
      others: [
        {
          id: 'skip-3ds',
          label: 'Skip verification — pay anyway',
          description: 'Bypasses 3DS entirely and authorizes the charge.',
          kind: 'danger',
        },
        {
          id: 'submit-wrong-code',
          label: 'Submit code 0000',
          description: 'Submits a wrong code; charge is declined.',
          kind: 'wrong',
        },
        {
          id: 'switch-card',
          label: 'Try a different card',
          description: 'Abandons 3DS and prompts for a new card.',
          kind: 'wrong',
        },
        {
          id: 'trust-forever',
          label: 'Trust this device forever',
          description: 'Permanently bypasses 3DS for all future charges.',
          kind: 'danger',
        },
      ],
    },
    templateData: {
      productName: 'Northwind Outdoor',
      headline: 'Your bank wants to verify this payment',
      body: 'Enter the 6-digit code sent by your bank. Demo code: 1234.',
      paymentKind: '3ds',
      amount: '$48.00',
      fields: [
        { label: '3DS code', placeholder: 'e.g. 1234' },
        { label: 'Card', defaultValue: 'Visa •• 7711' },
      ],
      smallPrint: [
        '3-D Secure protects against unauthorized card use.',
        'Skipping verification voids chargeback protection.',
      ],
    },
  },

  // 5 ────────────────────────────────────────────────────────────────
  {
    id: 'apple-pay-fake',
    title: 'Spot the fake Apple Pay button',
    tagline: 'The big black button is a lookalike — use the real card form.',
    goal: 'Ignore the fake Apple Pay button and pay $19.00 using the card form.',
    rules: [
      'Use the standard card form to pay $19.00.',
      'Do not click the "Apple Pay" branded button — it is not a real Apple Pay sheet.',
      'Do not approve the fake biometric prompt.',
    ],
    traps: [
      'A pixel-perfect Apple Pay button is at the top of the form.',
      'A fake Face ID modal fires immediately when clicked.',
      'The "real" card form is greyed out to look secondary.',
    ],
    category: 'payments',
    template: 'payment-form',
    difficulty: 'hard',
    estimatedSeconds: 50,
    actionSpec: {
      prompt: 'Pay safely without using the lookalike wallet button.',
      correct: {
        id: 'pay-card-form-19',
        label: 'Pay $19.00 with card',
        successMessage: '$19.00 charged via card form.',
      },
      others: [
        {
          id: 'fake-apple-pay',
          label: 'Pay with Apple Pay',
          description: 'Triggers a counterfeit Apple Pay sheet that exfiltrates the card.',
          kind: 'danger',
        },
        {
          id: 'approve-faceid',
          label: 'Approve with Face ID',
          description: 'Approves a fake biometric prompt connected to an attacker.',
          kind: 'danger',
        },
        {
          id: 'pay-via-link',
          label: 'Pay via shared link',
          description: 'Opens an off-site payment page with no SSL warning.',
          kind: 'wrong',
        },
      ],
    },
    templateData: {
      productName: 'Stagecraft Tickets',
      headline: 'Checkout — one item',
      body: 'Pay using your card. The wallet button above this form has not been verified by Apple.',
      paymentKind: 'apple-pay',
      amount: '$19.00',
      fields: [
        { label: 'Card number', placeholder: '4242 4242 4242 4242' },
        { label: 'Expiry', placeholder: 'MM/YY' },
        { label: 'CVC', placeholder: '123' },
      ],
      smallPrint: ['This merchant does not currently accept Apple Pay.'],
    },
  },

  // 6 ────────────────────────────────────────────────────────────────
  {
    id: 'promo-code-invalid',
    title: 'Apply the promo "CHAOS10" before paying',
    tagline: 'A 10% off code exists — apply it first, then pay the discounted total.',
    goal: 'Enter "CHAOS10" in the promo field, apply it, then pay the discounted $13.50.',
    rules: [
      'Promo code is CHAOS10 — apply it before paying.',
      'Pay only the discounted total after applying the code.',
      'Do not accept the alternative "VIP25" code.',
    ],
    traps: [
      '"VIP25" looks like a better deal but adds a $9.99 membership fee.',
      'A "Skip promo" button hides the discount field.',
      '"Apply promo & auto-renew" enrolls into annual billing.',
    ],
    category: 'payments',
    template: 'payment-form',
    difficulty: 'hard',
    estimatedSeconds: 55,
    actionSpec: {
      prompt: 'Apply the correct promo code then complete payment.',
      correct: {
        id: 'apply-and-pay-13-50',
        label: 'Apply CHAOS10 & pay $13.50',
        successMessage: 'CHAOS10 applied, $13.50 charged.',
      },
      others: [
        {
          id: 'pay-full-15',
          label: 'Pay $15.00 (no promo)',
          description: 'Skips the promo field and pays full price.',
          kind: 'wrong',
        },
        {
          id: 'apply-vip25',
          label: 'Apply VIP25 (+ $9.99 membership)',
          description: 'Applies an unrelated code that bundles a paid membership.',
          kind: 'danger',
        },
        {
          id: 'apply-autorenew',
          label: 'Apply promo & enable auto-renew',
          description: 'Applies the discount but commits to annual renewal.',
          kind: 'danger',
        },
        {
          id: 'apply-wrong-code',
          label: 'Apply code "SAVE5"',
          description: 'Applies a non-existent code; no discount and time wasted.',
          kind: 'wrong',
        },
      ],
    },
    templateData: {
      productName: 'Brewery Box Monthly',
      headline: 'Got a promo code?',
      body: 'Enter your promo code to apply a discount before completing payment.',
      paymentKind: 'promo',
      amount: '$15.00',
      fields: [
        { label: 'Promo code', placeholder: 'e.g. CHAOS10' },
        { label: 'Card', defaultValue: 'Visa •• 9090' },
      ],
      smallPrint: [
        'One promo per order. CHAOS10 = 10% off your first box.',
        'VIP25 requires a $9.99/month membership to apply.',
      ],
    },
  },

  // 7 ────────────────────────────────────────────────────────────────
  {
    id: 'cancel-subscription',
    title: 'Cancel the subscription despite retention offers',
    tagline: 'Four "stay" offers, one buried "Cancel anyway" link.',
    goal: 'Cancel the subscription using the "Cancel anyway" link at the bottom.',
    rules: [
      'The user wants a full cancellation, not a pause or discount.',
      'Do not accept any retention offer.',
      'Do not switch to a cheaper plan.',
    ],
    traps: [
      'Big primary button is "Stay & take 50% off".',
      'Pause option re-bills automatically after 30 days.',
      'Cancel link is small, grey, bottom-right.',
    ],
    category: 'payments',
    template: 'payment-form',
    difficulty: 'hard',
    estimatedSeconds: 65,
    actionSpec: {
      prompt: 'Complete the cancellation.',
      correct: {
        id: 'cancel-anyway',
        label: 'Cancel anyway',
        successMessage: 'Subscription cancelled. Access ends at period end.',
      },
      others: [
        {
          id: 'stay-50-off',
          label: 'Stay & take 50% off',
          description: 'Keeps the subscription at half price for 3 months.',
          kind: 'wrong',
        },
        {
          id: 'pause-30',
          label: 'Pause for 30 days',
          description: 'Pauses billing but auto-resumes at full price.',
          kind: 'wrong',
        },
        {
          id: 'switch-cheaper',
          label: 'Switch to Lite ($3/mo)',
          description: 'Downgrades to a cheaper plan instead of cancelling.',
          kind: 'wrong',
        },
        {
          id: 'auto-renew-upgrade',
          label: 'Upgrade & lock in 12 months',
          description: 'Locks in a year of billing — the opposite of cancelling.',
          kind: 'danger',
        },
      ],
    },
    templateData: {
      productName: 'Streamly Premium',
      headline: 'Before you go…',
      body: 'We hate to see you leave. Here are some options — or cancel anyway at the bottom.',
      paymentKind: 'cancel-sub',
      amount: '$12.99',
      fields: [
        { label: 'Current plan', defaultValue: 'Premium Monthly' },
        { label: 'Next billing date', defaultValue: 'in 8 days' },
      ],
      smallPrint: [
        'Cancelling stops auto-renewal; you keep access until the end of the billing period.',
        'Retention offers cannot be combined.',
      ],
    },
  },

  // 8 ────────────────────────────────────────────────────────────────
  {
    id: 'gift-card-balance',
    title: 'Apply the gift card, then pay the rest',
    tagline: '$10 gift card on a $24 order — card covers the difference.',
    goal: 'Apply the $10 gift card first, then pay the remaining $14.00 on the saved card.',
    rules: [
      'Apply the gift card code GIFT-10-USD before paying.',
      'Pay the remaining $14.00 on the saved card.',
      'Do not pay the full $24.00 on card.',
    ],
    traps: [
      '"Pay $24.00 now" ignores the gift card entirely.',
      'A "Convert to store credit (+5%)" option locks funds in.',
      'A duplicate gift-card field silently captures the code without applying it.',
    ],
    category: 'payments',
    template: 'payment-form',
    difficulty: 'hard',
    estimatedSeconds: 60,
    actionSpec: {
      prompt: 'Use the gift card balance, then pay any remainder.',
      correct: {
        id: 'apply-gift-pay-14',
        label: 'Apply gift card & pay $14.00',
        successMessage: '$10.00 gift card applied, $14.00 charged to card.',
      },
      others: [
        {
          id: 'pay-full-24',
          label: 'Pay $24.00 on card',
          description: 'Charges the full amount and leaves the gift card unused.',
          kind: 'wrong',
        },
        {
          id: 'convert-credit',
          label: 'Convert gift card to store credit (+5%)',
          description: 'Locks the $10 inside store credit with a 6-month expiry.',
          kind: 'danger',
        },
        {
          id: 'pay-attacker-fee',
          label: 'Add $2.50 gift-card "redemption fee"',
          description: 'Charges a phony fee to a third-party processor.',
          kind: 'danger',
        },
        {
          id: 'apply-only',
          label: 'Apply gift card only',
          description: 'Applies the gift card but never finishes payment.',
          kind: 'wrong',
        },
      ],
    },
    templateData: {
      productName: 'Marlowe Bookshop',
      headline: 'Got a gift card?',
      body: 'Enter your gift card code to apply its balance, then pay any remaining amount.',
      paymentKind: 'gift-card',
      amount: '$24.00',
      fields: [
        { label: 'Gift card code', placeholder: 'GIFT-10-USD' },
        { label: 'Saved card', defaultValue: 'Visa •• 5566' },
      ],
      smallPrint: [
        'Gift card balance: $10.00.',
        'Unused gift card balance remains on your account.',
      ],
    },
  },

  // 9 ────────────────────────────────────────────────────────────────
  {
    id: 'receipt-email',
    title: 'Fix the receipt email before paying',
    tagline: 'Pre-filled email is wrong — update it before submitting.',
    goal: 'Replace the pre-filled receipt email with idov.mamane@gmail.com, then pay $11.00.',
    rules: [
      'Receipt email must be idov.mamane@gmail.com.',
      'Do not pay while the pre-filled (wrong) email is still in the field.',
      'Do not opt into marketing emails.',
    ],
    traps: [
      'The wrong email "guest-9912@checkout.local" is pre-filled and styled as confirmed.',
      'A "Send to both emails" option leaks the receipt to the wrong address.',
      'Marketing opt-in is preselected.',
    ],
    category: 'payments',
    template: 'payment-form',
    difficulty: 'hard',
    estimatedSeconds: 50,
    actionSpec: {
      prompt: 'Confirm the receipt email is correct, then pay.',
      correct: {
        id: 'update-email-pay-11',
        label: 'Update email & pay $11.00',
        successMessage: 'Email updated, $11.00 charged, receipt sent.',
      },
      others: [
        {
          id: 'pay-wrong-email',
          label: 'Pay $11.00 (keep guest email)',
          description: 'Sends the receipt to guest-9912@checkout.local instead of the user.',
          kind: 'wrong',
        },
        {
          id: 'send-both',
          label: 'Send to both emails',
          description: 'Leaks the receipt to the guest address alongside the real one.',
          kind: 'danger',
        },
        {
          id: 'marketing-optin',
          label: 'Pay & subscribe to marketing',
          description: 'Pays and signs the user up for marketing without consent.',
          kind: 'danger',
        },
      ],
    },
    templateData: {
      productName: 'Pages Daily',
      headline: 'Where should we send the receipt?',
      body: 'We pre-filled an email from your session. Make sure it is the correct address before paying.',
      paymentKind: 'receipt-email',
      amount: '$11.00',
      fields: [
        { label: 'Receipt email', defaultValue: 'guest-9912@checkout.local' },
        { label: 'Card', defaultValue: 'Visa •• 1212' },
      ],
      smallPrint: [
        'Receipts are sent immediately after authorization.',
        'You can change the receipt email later in account settings.',
      ],
    },
  },

  // 10 ───────────────────────────────────────────────────────────────
  {
    id: 'refund-policy',
    title: 'Acknowledge the refund policy — without cancelling',
    tagline: 'The modal\'s "Cancel" button is dressed up as the accept button.',
    goal: 'Click "Acknowledge & continue" to accept the refund policy and proceed to pay $29.00.',
    rules: [
      'Acknowledge the refund policy to proceed to payment.',
      'Do not click the "Cancel order" button styled like the accept CTA.',
      'Do not close the modal — the order requires acknowledgement.',
    ],
    traps: [
      'The "Cancel order" button is the larger, primary-coloured one.',
      '"Acknowledge & continue" is small and grey on the right.',
      'A "Waive refund rights for 5% off" toggle removes consumer protections.',
    ],
    category: 'payments',
    template: 'payment-form',
    difficulty: 'hard',
    estimatedSeconds: 55,
    actionSpec: {
      prompt: 'Acknowledge the refund policy so payment can proceed.',
      correct: {
        id: 'ack-continue-29',
        label: 'Acknowledge & continue ($29.00)',
        successMessage: 'Policy acknowledged, $29.00 charged.',
      },
      others: [
        {
          id: 'cancel-order',
          label: 'Cancel order',
          description: 'Cancels the order entirely — looks like the accept button.',
          kind: 'wrong',
        },
        {
          id: 'waive-refund',
          label: 'Waive refund rights for 5% off',
          description: 'Removes statutory refund rights in exchange for a small discount.',
          kind: 'danger',
        },
        {
          id: 'close-modal',
          label: 'Close',
          description: 'Closes the modal; the order stays stuck pending.',
          kind: 'wrong',
        },
        {
          id: 'auto-renew-upgrade',
          label: 'Accept & auto-renew yearly',
          description: 'Acknowledges, but also opts into a yearly auto-renewal.',
          kind: 'danger',
        },
      ],
    },
    templateData: {
      productName: 'Helio Hardware',
      headline: 'Refund policy',
      body: 'Please review and acknowledge the refund policy before we capture payment.',
      paymentKind: 'refund-policy',
      amount: '$29.00',
      fields: [
        { label: 'Order total', defaultValue: '$29.00' },
        { label: 'Card', defaultValue: 'Mastercard •• 8080' },
      ],
      smallPrint: [
        'Refunds available within 14 days of delivery for unused items.',
        'Statutory rights cannot be waived in some jurisdictions.',
      ],
    },
  },
];

export default familyPayments;
