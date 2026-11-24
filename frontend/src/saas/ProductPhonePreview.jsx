import { useState } from 'react';
import { ArrowUpRight, BatteryFull, Signal, Wifi } from 'lucide-react';
import { PRODUCT_SCREEN_ROOT } from './productClientCaptureData.js';
import './productPhonePreview.css';

const descriptions = {
  create: 'Studio project creation form with client and event details',
  quote: 'New quotation with the sample client and project selected',
  invoice: 'Linked draft invoice with the option to approve and issue it',
  collect: 'Studio payment record with the project value, deposit received and payment status',
};

function PhoneDisplay({ stage, children }) {
  const [screenFailed, setScreenFailed] = useState(false);
  const [frameFailed, setFrameFailed] = useState(false);
  const base = PRODUCT_SCREEN_ROOT + 'mobile-workflow-' + stage;
  const description = descriptions[stage];

  return <div className="sos-phone-preview" data-stage={stage}>
    <div className="sos-phone-preview-device" data-frame-failed={frameFailed || undefined}>
      <div className="sos-phone-preview-display" data-screen-failed={screenFailed || undefined}>
        <div className="sos-phone-preview-status" aria-hidden="true">
          <b>9:41</b><span><Signal /><Wifi /><BatteryFull /></span>
        </div>
        <div className="sos-phone-preview-screen" role="region" tabIndex={0} aria-label={description + '. Scroll to explore.'}>
          {screenFailed ? children || <p className="sos-phone-preview-unavailable">The sample screen couldn’t load.</p> :
            <picture>
              <source media="(prefers-color-scheme: dark)" srcSet={base + '-dark@2x.webp'} />
              <img src={base + '-light@2x.webp'} width="780" height="1688" loading="lazy" decoding="async"
                alt={description + '. Fictional sample workspace.'}
                onError={() => setScreenFailed(true)} />
            </picture>}
        </div>
        <div className="sos-phone-preview-home" aria-hidden="true"><i /></div>
      </div>
      {!frameFailed && <img className="sos-phone-preview-frame" src="/assets/studio-x-os/devices/iphone-18-pro-2026.png"
        width="389" height="800" alt="" loading="lazy" decoding="async" onError={() => setFrameFailed(true)} />}
    </div>
    {!screenFailed && ['light', 'dark'].map(theme => <a key={theme} className="sos-phone-preview-open" data-theme={theme}
      href={base + '-' + theme + '@2x.webp'} target="_blank" rel="noopener"
      aria-label={'Open full-size screen in a new tab. ' + description}>Open full-size screen<ArrowUpRight size={15} aria-hidden="true" /></a>)}
  </div>;
}

export default function ProductPhonePreview({ stage = 'create', children }) {
  const selected = Object.hasOwn(descriptions, stage) ? stage : 'create';
  return <PhoneDisplay key={selected} stage={selected}>{children}</PhoneDisplay>;
}
