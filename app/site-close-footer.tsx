'use client';

import Link from 'next/link';
import { Localized } from './localized';

export function SiteCloseFooter({ close = true }: { close?: boolean }) {
  return (
    <footer className={`cf-footer${close ? '' : ' is-foot-only'}`} id="contact">
      {close ? (
        <div className="cf-close">
          <div className="cf-close-copy">
            <h2 className="cf-close-bio">
              <Localized
                en={<>
                  I&apos;m a Shenzhen-based senior UI designer focused on intelligent hardware interfaces,
                  motion and visual systems. I work across product UI, companion apps and shared design
                  language for hardware families — from concept exploration through design delivery.
                  <br /><br />
                  With experience spanning DJI, CVTE and Tencent, I&apos;ve led interfaces for robot vacuum,
                  e-bike, power and flight-control products, balancing clarity of use with a coherent
                  visual system across device and mobile.
                </>}
                zh={<>
                  我是一名常驻深圳的高级 UI 设计师，专注智能硬件界面、动效与视觉系统。工作覆盖产品 UI、配套 App，以及硬件产品家族的共享设计语言——从概念探索到设计交付。
                  <br /><br />
                  曾在大疆、视源与腾讯工作，主导过扫地机器人、电助力自行车、移动电源与飞控等产品的界面设计，在使用清晰度与跨设备统一视觉语言之间取得平衡。
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
      ) : null}

      <div className="cf-site-foot">
        <div className="cf-site-foot-inner">
          <div className="cf-site-foot-meta">
            <span>Shane Zhu</span>
            <span><Localized en="Select Work" zh="精选作品" /></span>
            <span>2026</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
