'use client';

import Link from 'next/link';
import { Localized } from './localized';

/** Home close block only — global Shane Zhu / 2018-2026© lives in layout via SiteFoot. */
export function SiteCloseFooter() {
  return (
    <div className="cf-footer" id="contact">
      <div className="cf-close">
        <div className="cf-close-copy">
          <h2 className="cf-close-bio">
            <Localized
              en={<>
                I&apos;m a Shenzhen-based UI designer focused on intelligent hardware interfaces,
                motion and visual systems, working across product UI, companion apps and cross-device
                experiences for hardware families, from concept to execution.
                <br /><br />
                I&apos;ve worked at DJI, CVTE and Tencent, leading interface design for robot vacuums,
                e-bikes, portable power stations and flight-control products—making complex functions
                easier to understand while maintaining a consistent experience and visual language
                across devices.
              </>}
              zh={<>
                我是一名常驻深圳的 UI 设计师，专注智能硬件界面、动效与视觉系统，工作涵盖产品 UI、配套 App 与硬件产品家族的跨端体验，参与设计从概念构想到落地的完整过程。
                <br /><br />
                曾任职于大疆、视源与腾讯，主导扫地机器人、电助力自行车、移动电源及飞控等产品的界面设计，致力于让复杂功能更易理解，并在不同设备间保持体验与视觉表达的一致性。
              </>}
            />
          </h2>
          <Link href="/about" className="cf-close-cta">
            <span><Localized en="Learn more" zh="了解更多" /></span>
            <span className="cf-close-cta-arrow" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 8H15" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" />
                <path d="M9.5 2.5L15 8L9.5 13.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" strokeLinejoin="miter" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
