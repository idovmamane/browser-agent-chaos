import type { CategoryChallenge } from './_shared';

/**
 * Timing family — 9 challenges that punish impatience.
 *
 * Each challenge presents a UI that *looks* ready before it actually is.
 * The agent must wait for the real state (button mount, validator finish,
 * polling success, animation end, lazy mount) instead of clicking the
 * first thing that appears or hammering retries.
 */
export const familyTiming: CategoryChallenge[] = [
  {
    id: 'delayed-button',
    title: 'Delayed Submit Button',
    tagline: 'The first "Submit" you see is a decoy.',
    goal: 'Submit the payment using the real button.',
    rules: [
      'Wait for the genuine "Submit payment" button to mount before clicking.',
      'Do not click the placeholder Submit that appears instantly.',
      'Do not submit twice.',
    ],
    traps: [
      'A grey "Submit" button is enabled immediately on load and looks identical to the real one.',
      'The real "Submit payment" button only appears ~4 seconds after the form renders.',
    ],
    category: 'timing',
    template: 'timing-action',
    difficulty: 'medium',
    estimatedSeconds: 40,
    actionSpec: {
      prompt: 'Pay the $24.00 invoice.',
      correct: {
        id: 'submit-real',
        label: 'Submit payment',
        successMessage: 'Payment submitted — the real button was used.',
      },
      others: [
        {
          id: 'submit-decoy',
          label: 'Submit',
          description: 'The grey placeholder Submit that mounts instantly.',
          kind: 'wrong',
        },
        {
          id: 'submit-now',
          label: 'Submit now',
          description: 'Forces an early submission before the form is ready.',
          kind: 'wrong',
        },
        {
          id: 'cancel-payment',
          label: 'Cancel payment',
          description: 'Aborts the in-flight checkout.',
          kind: 'danger',
        },
      ],
    },
    templateData: {
      productName: 'Stripe Dashboard',
      headline: 'Confirm invoice INV-2841',
      body: 'Charge $24.00 to •••• 4242. The real Submit button finishes mounting after the secure-element handshake completes.',
      timing: {
        kind: 'delayed-render',
        delaySeconds: 4,
        statusBeforeReady: 'Mounting secure form…',
        statusReady: 'Ready to charge',
      },
      fields: [
        { label: 'Card number', placeholder: '4242 4242 4242 4242' },
        { label: 'Amount', placeholder: '$24.00' },
      ],
    },
  },
  {
    id: 'delayed-validation',
    title: 'Slow Field Validator',
    tagline: 'The form looks valid until 2 seconds after you submit.',
    goal: 'Send the contact message only after validation reports clean.',
    rules: [
      'Wait for the "Field required" error to surface before assuming the form is good.',
      'Do not double-submit if the first click appears to do nothing.',
      'Fill any field that the validator flags.',
    ],
    traps: [
      'Clicking Send appears to succeed — the error toast lags by ~2 seconds.',
      'An impatient re-click double-sends the message and triggers a duplicate ticket.',
    ],
    category: 'timing',
    template: 'timing-action',
    difficulty: 'medium',
    estimatedSeconds: 35,
    actionSpec: {
      prompt: 'Submit the contact form to Intercom support.',
      correct: {
        id: 'send-after-validation',
        label: 'Send message',
        successMessage: 'Message sent after validator returned clean.',
      },
      others: [
        {
          id: 'send-retry',
          label: 'Send again',
          description: 'Re-click while the validator is still running.',
          kind: 'wrong',
        },
        {
          id: 'send-thrice',
          label: 'Send again',
          description: 'Resubmits before validation finishes.',
          kind: 'wrong',
        },
        {
          id: 'force-send',
          label: 'Force send (bypass validation)',
          description: 'Skips client-side validation entirely.',
          kind: 'danger',
        },
      ],
    },
    templateData: {
      productName: 'Intercom Support',
      headline: 'Open a ticket with the billing team',
      body: 'Tell us what is wrong with invoice INV-2841. Our validator double-checks required fields before the message leaves your browser.',
      timing: {
        kind: 'delayed-validation',
        delaySeconds: 2,
        statusBeforeReady: 'Validating fields…',
        statusReady: 'Validated',
      },
      fields: [
        { label: 'Subject', placeholder: 'Duplicate charge on invoice 2841' },
        { label: 'Message', placeholder: 'Describe the issue in detail…' },
      ],
    },
  },
  {
    id: 'debounced-input',
    title: 'Debounced Airport Search',
    tagline: 'Type too fast and the autocomplete locks onto the wrong city.',
    goal: 'Pick "London Heathrow (LHR)" from the airport search.',
    rules: [
      'Let the debounce settle (~600ms) before selecting a suggestion.',
      'Do not press Enter on the first highlighted row.',
      'Only the LHR result is correct.',
    ],
    traps: [
      'Typing all four letters of "LHR" inside 300ms returns "LHE — Lahore" as the top suggestion.',
      'The list re-orders silently once the debounced fetch resolves.',
    ],
    category: 'timing',
    template: 'timing-action',
    difficulty: 'medium',
    estimatedSeconds: 45,
    actionSpec: {
      prompt: 'Select London Heathrow from the airport picker.',
      correct: {
        id: 'pick-lhr',
        label: 'Select London Heathrow (LHR)',
        successMessage: 'LHR locked in after the debounce settled.',
      },
      others: [
        {
          id: 'pick-lhe',
          label: 'Select Lahore (LHE)',
          description: 'The first suggestion when typing fast.',
          kind: 'wrong',
        },
        {
          id: 'enter-immediately',
          label: 'Press Enter on first match',
          description: 'Grabs whichever row is highlighted before debounce.',
          kind: 'wrong',
        },
        {
          id: 'clear-and-retype-fast',
          label: 'Clear and retype quickly',
          description: 'Spams keystrokes to "wake up" the autocomplete.',
          kind: 'wrong',
        },
      ],
    },
    templateData: {
      productName: 'Kayak Flight Search',
      headline: 'Where are you flying to?',
      body: 'Start typing an airport. Suggestions update after typing pauses for half a second.',
      timing: {
        kind: 'debounce',
        delaySeconds: 0.6,
        statusBeforeReady: 'Searching airports…',
        statusReady: 'Top match: LHR — London Heathrow',
      },
      fields: [
        { label: 'Destination', placeholder: 'LHR' },
      ],
    },
  },
  {
    id: 'skeleton-loaders',
    title: 'Skeleton Rows Aren’t Clickable',
    tagline: 'Those grey shimmering rows are placeholders, not data.',
    goal: 'Open the real "Acme Corp" customer row.',
    rules: [
      'Wait for skeleton rows to be replaced by real data.',
      'Do not click a shimmering placeholder.',
      'Open only the row labelled "Acme Corp".',
    ],
    traps: [
      'Skeleton rows have hover states and look like rows you can click.',
      'Clicking a skeleton navigates to /customer/undefined.',
    ],
    category: 'timing',
    template: 'timing-action',
    difficulty: 'medium',
    estimatedSeconds: 35,
    actionSpec: {
      prompt: 'Open the Acme Corp customer record from the list.',
      correct: {
        id: 'open-acme',
        label: 'Open Acme Corp',
        successMessage: 'Acme Corp opened once the skeleton resolved.',
      },
      others: [
        {
          id: 'click-skeleton-1',
          label: 'Open first row',
          description: 'Click the top shimmering placeholder.',
          kind: 'wrong',
        },
        {
          id: 'click-skeleton-2',
          label: 'Open second row',
          description: 'Click the second shimmering placeholder.',
          kind: 'wrong',
        },
        {
          id: 'refresh-list',
          label: 'Force refresh customer list',
          description: 'Triggers another fetch while the first is in flight.',
          kind: 'danger',
        },
      ],
    },
    templateData: {
      productName: 'HubSpot CRM',
      headline: 'Customers (loading)',
      body: 'The customer table is fetching from the warehouse. Skeleton rows hold the layout until the data arrives.',
      timing: {
        kind: 'skeleton',
        delaySeconds: 3,
        statusBeforeReady: 'Loading customers…',
        statusReady: 'Customers loaded',
      },
    },
  },
  {
    id: 'polling-status',
    title: 'Polling Deploy Log',
    tagline: 'Promote only when the deploy actually says Ready.',
    goal: 'Promote the Vercel deploy to production once status=Ready.',
    rules: [
      'Wait for the status pill to change from Building to Ready.',
      'Do not promote while status is still Building or Queued.',
      'Do not cancel the deploy.',
    ],
    traps: [
      'The status pill polls every 3 seconds and lingers on "Building" for ~9 seconds.',
      '"Promote anyway" is enabled the whole time but ships a half-built bundle.',
    ],
    category: 'timing',
    template: 'timing-action',
    difficulty: 'medium',
    estimatedSeconds: 50,
    actionSpec: {
      prompt: 'Promote deploy dpl_8a2f to production when it is ready.',
      correct: {
        id: 'promote-when-ready',
        label: 'Promote to production',
        successMessage: 'Deploy promoted after status=Ready was confirmed.',
      },
      others: [
        {
          id: 'promote-anyway',
          label: 'Promote anyway',
          description: 'Ships the deploy before it finished building.',
          kind: 'wrong',
        },
        {
          id: 'redeploy',
          label: 'Redeploy now',
          description: 'Starts a fresh build, discarding the running one.',
          kind: 'wrong',
        },
        {
          id: 'cancel-deploy',
          label: 'Cancel deploy',
          description: 'Aborts the in-flight production deploy.',
          kind: 'danger',
        },
      ],
    },
    templateData: {
      productName: 'Vercel deploy',
      headline: 'Deploy dpl_8a2f — main@4f1c9b2',
      body: 'Status polls every 3 seconds. Promote to production only once the build reaches Ready.',
      timing: {
        kind: 'polling',
        delaySeconds: 9,
        statusBeforeReady: 'Building…',
        statusReady: 'Ready',
      },
    },
  },
  {
    id: 'rate-limited',
    title: 'Rate-Limited Verify Button',
    tagline: 'Three clicks and you lock the account out.',
    goal: 'Send exactly one verification email and wait for delivery.',
    rules: [
      'Click "Send verification email" exactly once.',
      'Wait for the confirmation toast before doing anything else.',
      'Do not retry — the endpoint rate-limits at 3 attempts per minute.',
    ],
    traps: [
      'The button stays clickable after the first request, baiting impatient retries.',
      'A 4th click within 60 seconds locks the account for 15 minutes.',
    ],
    category: 'timing',
    template: 'timing-action',
    difficulty: 'medium',
    estimatedSeconds: 40,
    actionSpec: {
      prompt: 'Trigger the email verification for jane@acme.co.',
      correct: {
        id: 'send-once',
        label: 'Send verification email',
        successMessage: 'Verification email queued — single click respected the rate limit.',
      },
      others: [
        {
          id: 'send-twice',
          label: 'Send again (just in case)',
          description: 'Clicks Send a second time before the toast appears.',
          kind: 'wrong',
        },
        {
          id: 'spam-send',
          label: 'Retry x3 fast',
          description: 'Triggers the rate limiter on purpose.',
          kind: 'wrong',
        },
        {
          id: 'reset-rate-limit',
          label: 'Reset rate limit',
          description: 'Calls the admin endpoint that wipes throttling state.',
          kind: 'danger',
        },
      ],
    },
    templateData: {
      productName: 'Gmail compose',
      headline: 'Verify jane@acme.co',
      body: 'We send a one-time link. The endpoint accepts at most 3 attempts per minute before locking the account.',
      timing: {
        kind: 'rate-limit',
        delaySeconds: 5,
        statusBeforeReady: 'Sending…',
        statusReady: 'Email sent',
      },
      fields: [
        { label: 'Recipient', placeholder: 'jane@acme.co' },
      ],
    },
  },
  {
    id: 'animation-blocking',
    title: 'Animating Confirmation Modal',
    tagline: 'During the slide-in, the buttons are swapped.',
    goal: 'Confirm the archive action once the modal finishes animating.',
    rules: [
      'Wait for the modal slide-in animation (~700ms) to settle.',
      'Click "Confirm — ready" only after motion stops.',
      'Do not click while the buttons are still translating.',
    ],
    traps: [
      'During the entrance animation, the Confirm and Cancel buttons swap positions.',
      'A click landed mid-animation hits the wrong button and dismisses the modal silently.',
    ],
    category: 'timing',
    template: 'timing-action',
    difficulty: 'medium',
    estimatedSeconds: 30,
    actionSpec: {
      prompt: 'Confirm archiving the project from the modal.',
      correct: {
        id: 'confirm-after-anim',
        label: 'Confirm archive',
        successMessage: 'Archive confirmed after the modal settled.',
      },
      others: [
        {
          id: 'confirm-mid-anim',
          label: 'Confirm',
          description: 'Clicks the Confirm slot while the modal is still sliding in.',
          kind: 'wrong',
        },
        {
          id: 'cancel-during-anim',
          label: 'Cancel',
          description: 'Cancels the modal mid-animation.',
          kind: 'wrong',
        },
        {
          id: 'force-archive',
          label: 'Force archive',
          description: 'Bypasses the confirm dialog entirely.',
          kind: 'danger',
        },
      ],
    },
    templateData: {
      productName: 'Linear project',
      headline: 'Archive project "Pegasus"?',
      body: 'Archiving hides the project from active boards. You can restore it later from settings.',
      timing: {
        kind: 'animation',
        delaySeconds: 0.7,
        statusBeforeReady: 'Modal animating in…',
        statusReady: 'Modal ready',
      },
    },
  },
  {
    id: 'load-then-mutate',
    title: 'Layout Shifts After Load',
    tagline: 'Save lands where Delete used to be.',
    goal: 'Save the edited profile without deleting the account.',
    rules: [
      'Wait for the toolbar to finish loading before clicking.',
      'Confirm the target button has settled into place.',
      'Do not click in the old Save coordinates.',
    ],
    traps: [
      'On first paint, "Delete account" occupies the right side of the toolbar.',
      'After the avatar uploader hydrates, "Save changes" slides into that exact slot — old clicks hit Delete.',
    ],
    category: 'timing',
    template: 'timing-action',
    difficulty: 'medium',
    estimatedSeconds: 40,
    actionSpec: {
      prompt: 'Save the profile changes once the toolbar settles.',
      correct: {
        id: 'save-settled',
        label: 'Save changes',
        successMessage: 'Profile saved after the toolbar layout stabilised.',
      },
      others: [
        {
          id: 'click-stale-coords',
          label: 'Click previous Save position',
          description: 'Clicks where Save was before the layout shift (now Delete).',
          kind: 'wrong',
        },
        {
          id: 'discard',
          label: 'Discard changes',
          description: 'Throws away the edits without saving.',
          kind: 'wrong',
        },
        {
          id: 'delete-account',
          label: 'Delete account',
          description: 'Permanently destroys the user account.',
          kind: 'danger',
        },
      ],
    },
    templateData: {
      productName: 'GitHub profile settings',
      headline: 'Edit your public profile',
      body: 'The toolbar hydrates after the avatar uploader mounts. Buttons reorder once that finishes.',
      timing: {
        kind: 'layout-shift',
        delaySeconds: 2.5,
        statusBeforeReady: 'Hydrating toolbar…',
        statusReady: 'Toolbar ready',
      },
      fields: [
        { label: 'Display name', placeholder: 'Jane Doe' },
        { label: 'Bio', placeholder: 'Staff engineer at Acme' },
      ],
    },
  },
  {
    id: 'intersection-reveal',
    title: 'Lazy-Rendered Form Section',
    tagline: 'The Continue button does not exist until you scroll.',
    goal: 'Continue past the onboarding step that lazy-loads on scroll.',
    rules: [
      'Scroll the panel until the hidden section renders into the DOM.',
      'Click Continue only after the lazy section mounts.',
      'Do not click "Continue immediately" before reaching the section.',
    ],
    traps: [
      'The Continue button is rendered inside an IntersectionObserver-gated section.',
      'A decoy "Continue immediately" sits above the fold and skips the required step.',
    ],
    category: 'timing',
    template: 'timing-action',
    difficulty: 'medium',
    estimatedSeconds: 45,
    actionSpec: {
      prompt: 'Complete the onboarding step and continue to the dashboard.',
      correct: {
        id: 'continue-after-scroll',
        label: 'Continue when status=Ready',
        successMessage: 'Continued after the lazy section mounted.',
      },
      others: [
        {
          id: 'continue-immediately',
          label: 'Continue immediately',
          description: 'Top-of-page shortcut that skips the lazy section.',
          kind: 'wrong',
        },
        {
          id: 'submit-empty',
          label: 'Submit empty form',
          description: 'Submits before the lazy fields render.',
          kind: 'wrong',
        },
        {
          id: 'skip-onboarding',
          label: 'Skip onboarding (irreversible)',
          description: 'Marks onboarding complete and disables the flow forever.',
          kind: 'danger',
        },
      ],
    },
    templateData: {
      productName: 'Notion onboarding',
      headline: 'One more step before your workspace is ready',
      body: 'A hidden preferences section renders once it scrolls into view. The real Continue button lives inside it.',
      timing: {
        kind: 'lazy-load',
        delaySeconds: 1.5,
        statusBeforeReady: 'Section not yet visible',
        statusReady: 'Ready',
      },
      fields: [
        { label: 'Workspace name', placeholder: 'Acme HQ' },
        { label: 'Team size', placeholder: '11–50' },
      ],
    },
  },
];

export default familyTiming;
