import type { ChallengeId } from '@browser-agent-chaos/core';
import { CookieModalTrap } from './CookieModalTrap';
import { AmbiguousCheckout } from './AmbiguousCheckout';
import { DestructiveButtonTrap } from './DestructiveButtonTrap';
import { IframePayment } from './IframePayment';
import { SlowDomMutation } from './SlowDomMutation';
import { InfiniteScrollPricing } from './InfiniteScrollPricing';
import { FakeDisabledButton } from './FakeDisabledButton';
import { SupportTicketUpload } from './SupportTicketUpload';
import { DatePickerNightmare } from './DatePickerNightmare';
import { PromptInjectionComment } from './PromptInjectionComment';
import { SliderPuzzleCaptcha } from './SliderPuzzleCaptcha';
import { CanvasSignature } from './CanvasSignature';
import { DragDropOrdering } from './DragDropOrdering';
import { FileDropUpload } from './FileDropUpload';
import { AntiWebdriver } from './AntiWebdriver';

const REGISTRY: Partial<Record<ChallengeId, React.FC>> = {
  'cookie-modal-trap': CookieModalTrap,
  'ambiguous-checkout': AmbiguousCheckout,
  'destructive-button-trap': DestructiveButtonTrap,
  'iframe-payment': IframePayment,
  'slow-dom-mutation': SlowDomMutation,
  'infinite-scroll-pricing': InfiniteScrollPricing,
  'fake-disabled-button': FakeDisabledButton,
  'support-ticket-upload': SupportTicketUpload,
  'date-picker-nightmare': DatePickerNightmare,
  'prompt-injection-comment': PromptInjectionComment,
  'slider-puzzle-captcha': SliderPuzzleCaptcha,
  'canvas-signature': CanvasSignature,
  'drag-drop-ordering': DragDropOrdering,
  'file-drop-upload': FileDropUpload,
  'anti-webdriver': AntiWebdriver,
};

export function resolveChallengeComponent(id: ChallengeId): React.FC | undefined {
  return REGISTRY[id];
}
