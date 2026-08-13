import { test, expect } from '@playwright/test';

test.describe('Tunely Advanced Responsive UI Audit', () => {
  test('Comprehensive Responsive UI, Layout, Overlap, and Accessibility Audit', async ({ page }, testInfo) => {
    // 1. Navigate to application
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Wait briefly for layout & images to settle
    await page.waitForTimeout(1000);

    const viewport = page.viewportSize();
    const viewportName = testInfo.project.name;
    const isMobile = (viewport?.width || 0) <= 768;

    console.log(`\n==================================================`);
    console.log(`🔍 AUDITING VIEWPORT: ${viewportName} (${viewport?.width}x${viewport?.height})`);
    console.log(`==================================================`);

    // 2. Perform deep client-side DOM evaluation
    const auditResults = await page.evaluate(({ vpName, mobileFlag }) => {
      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;
      const docWidth = document.documentElement.scrollWidth;
      const docHeight = document.documentElement.scrollHeight;

      const criticalFindings = [];
      const warningFindings = [];
      const infoFindings = [];

      // Helper: format element string
      const getElSelector = (el) => {
        if (!el) return 'unknown';
        const tag = el.tagName ? el.tagName.toLowerCase() : 'element';
        const id = el.id ? `#${el.id}` : '';
        const cls = typeof el.className === 'string' && el.className.trim()
          ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
          : '';
        const text = (el.innerText || el.textContent || '').trim().slice(0, 30);
        return `<${tag}${id}${cls}>${text ? ` "${text}"` : ''}`;
      };

      // Helper: check element visibility
      const isVisible = (el) => {
        if (!el || el.nodeType !== 1) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      // ── A. DOCUMENT & ELEMENT VIEWPORT BOUNDARIES ──
      if (docWidth > winWidth + 2) {
        criticalFindings.push({
          category: 'DOCUMENT_OVERFLOW',
          viewport: `${winWidth}x${winHeight}`,
          element: 'document.documentElement',
          issue: `Document horizontal scroll overflow detected: ${docWidth}px > viewport ${winWidth}px`,
          coordinates: { docWidth, winWidth, overflowAmount: docWidth - winWidth },
          severity: 'CRITICAL'
        });
      }

      // Check visible elements extending beyond right viewport edge
      const allElements = Array.from(document.querySelectorAll('body *'));
      const overflowingElements = [];

      for (const el of allElements) {
        if (!isVisible(el)) continue;
        const style = window.getComputedStyle(el);
        // Ignore full-screen fixed overlays/modal backdrops
        if (style.position === 'fixed' || style.position === 'absolute') {
          if (parseFloat(style.width) >= winWidth || el.classList.contains('import-modal-overlay') || el.classList.contains('auth-modal-overlay')) {
            continue;
          }
        }
        const rect = el.getBoundingClientRect();
        if (rect.right > winWidth + 4 && rect.left < winWidth) {
          overflowingElements.push({
            el: getElSelector(el),
            rect: { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) }
          });
          if (overflowingElements.length >= 5) break;
        }
      }

      if (overflowingElements.length > 0) {
        criticalFindings.push({
          category: 'ELEMENT_VIEWPORT_OVERFLOW',
          viewport: `${winWidth}x${winHeight}`,
          element: overflowingElements.map(e => e.el).join(', '),
          issue: `${overflowingElements.length} visible element(s) extend past right viewport boundary`,
          coordinates: overflowingElements.map(e => e.rect),
          severity: 'CRITICAL'
        });
      }

      // ── B. INTERNAL CONTAINER OVERFLOW ──
      const scrollableContainers = [];
      for (const el of allElements) {
        if (!isVisible(el)) continue;
        const style = window.getComputedStyle(el);
        const overflowX = style.overflowX;
        
        if (el.scrollWidth > el.clientWidth + 4) {
          const isIntentionalCarousel = el.classList.contains('recently-liked-carousel') ||
            el.classList.contains('category-scroll') ||
            el.classList.contains('carousel-container') ||
            overflowX === 'auto' || overflowX === 'scroll';
          
          if (isIntentionalCarousel) {
            infoFindings.push({
              category: 'INTENTIONAL_SCROLL_CONTAINER',
              viewport: `${winWidth}x${winHeight}`,
              element: getElSelector(el),
              issue: `Intentional horizontally scrollable container (${el.scrollWidth}px > ${el.clientWidth}px)`,
              coordinates: { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth },
              severity: 'INFO'
            });
          } else {
            warningFindings.push({
              category: 'UNINTENDED_INTERNAL_OVERFLOW',
              viewport: `${winWidth}x${winHeight}`,
              element: getElSelector(el),
              issue: `Container internal horizontal overflow without scroll styling (${el.scrollWidth}px > ${el.clientWidth}px)`,
              coordinates: { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth },
              severity: 'WARNING'
            });
          }
        }
      }

      // ── C. FIXED / STICKY ELEMENTS & MOBILE BOTTOM 150px AUDIT ──
      const fixedElements = [];
      for (const el of allElements) {
        if (!isVisible(el)) continue;
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
          const rect = el.getBoundingClientRect();
          fixedElements.push({
            selector: getElSelector(el),
            position: style.position,
            zIndex: style.zIndex,
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            height: Math.round(rect.height)
          });
          infoFindings.push({
            category: 'FIXED_STICKY_ELEMENT',
            viewport: `${winWidth}x${winHeight}`,
            element: getElSelector(el),
            issue: `Position ${style.position} element detected (z-index: ${style.zIndex})`,
            coordinates: { top: Math.round(rect.top), bottom: Math.round(rect.bottom), zIndex: style.zIndex },
            severity: 'INFO'
          });
        }
      }

      // Check Mobile Bottom 150px Area Collisions
      if (mobileFlag) {
        const bottomFixed = fixedElements.filter(f => f.bottom >= winHeight - 150);
        if (bottomFixed.length >= 2) {
          warningFindings.push({
            category: 'MOBILE_BOTTOM_BAR_STACKING',
            viewport: `${winWidth}x${winHeight}`,
            element: bottomFixed.map(f => f.selector).join(' & '),
            issue: `Multiple fixed/sticky elements in mobile bottom 150px area (PlayerBar / Navigation)`,
            coordinates: bottomFixed,
            severity: 'WARNING'
          });
        }
      }

      // ── D. INTERACTIVE TOUCH TARGET AUDIT (<44x44px) ──
      const interactiveElements = Array.from(document.querySelectorAll('button, a, input, [role="button"], .song-row, .recently-liked-card'));
      let smallTouchTargetCount = 0;
      const smallTargetsList = [];

      for (const el of interactiveElements) {
        if (!isVisible(el)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) { // 40px threshold for warnings
          smallTouchTargetCount++;
          if (smallTargetsList.length < 5) {
            smallTargetsList.push({
              element: getElSelector(el),
              dimensions: `${Math.round(rect.width)}x${Math.round(rect.height)}px`
            });
          }
        }
      }

      if (smallTouchTargetCount > 0) {
        warningFindings.push({
          category: 'SMALL_TOUCH_TARGETS',
          viewport: `${winWidth}x${winHeight}`,
          element: `${smallTouchTargetCount} interactive element(s)`,
          issue: `${smallTouchTargetCount} interactive target(s) smaller than recommended 44x44px (e.g. ${smallTargetsList.map(s => `${s.element} [${s.dimensions}]`).join(', ')})`,
          coordinates: smallTargetsList,
          severity: 'WARNING'
        });
      }

      // ── E. TEXT CLIPPING WITHOUT ELLIPSIS AUDIT ──
      const textElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, p, span, button'));
      const clippedTexts = [];

      for (const el of textElements) {
        if (!isVisible(el)) continue;
        if (el.children.length > 2) continue; // skip complex container wrappers
        const style = window.getComputedStyle(el);
        if (style.overflow === 'hidden' || style.textOverflow === 'clip') {
          if (el.scrollWidth > el.clientWidth + 4 && style.textOverflow !== 'ellipsis') {
            clippedTexts.push({
              element: getElSelector(el),
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth
            });
            if (clippedTexts.length >= 5) break;
          }
        }
      }

      if (clippedTexts.length > 0) {
        warningFindings.push({
          category: 'TEXT_CLIPPING_NO_ELLIPSIS',
          viewport: `${winWidth}x${winHeight}`,
          element: clippedTexts.map(t => t.element).join(', '),
          issue: `Text clipped without CSS text-overflow: ellipsis`,
          coordinates: clippedTexts,
          severity: 'WARNING'
        });
      }

      // ── F. REAL ELEMENT OVERLAP AUDIT ──
      const keyInteractiveList = Array.from(document.querySelectorAll('button, .player-bar, .mobile-tab-bar, .sidebar, .liked-songs-grid-card, .recently-liked-card'));
      const visibleKeyEls = keyInteractiveList.filter(el => isVisible(el) && !el.classList.contains('close-drawer-btn') && !el.classList.contains('modal-close-btn') && !el.classList.contains('import-close-btn'));
      const overlaps = [];

      for (let i = 0; i < visibleKeyEls.length; i++) {
        for (let j = i + 1; j < visibleKeyEls.length; j++) {
          const elA = visibleKeyEls[i];
          const elB = visibleKeyEls[j];
          if (elA.contains(elB) || elB.contains(elA)) continue; // skip parent-child

          const rA = elA.getBoundingClientRect();
          const rB = elB.getBoundingClientRect();

          const overlapWidth = Math.max(0, Math.min(rA.right, rB.right) - Math.max(rA.left, rB.left));
          const overlapHeight = Math.max(0, Math.min(rA.bottom, rB.bottom) - Math.max(rA.top, rB.top));
          const overlapArea = overlapWidth * overlapHeight;

          if (overlapArea > 200) { // minimum 200 sq px overlap
            overlaps.push({
              elA: getElSelector(elA),
              elB: getElSelector(elB),
              overlapArea: Math.round(overlapArea)
            });
            if (overlaps.length >= 3) break;
          }
        }
      }

      if (overlaps.length > 0) {
        criticalFindings.push({
          category: 'ELEMENT_OVERLAP_COLLISION',
          viewport: `${winWidth}x${winHeight}`,
          element: overlaps.map(o => `${o.elA} 💥 ${o.elB}`).join('; '),
          issue: `Suspicious non-parent-child element overlap detected`,
          coordinates: overlaps,
          severity: 'CRITICAL'
        });
      }

      return {
        criticalFindings,
        warningFindings,
        infoFindings,
        docWidth,
        docHeight,
        winWidth,
        winHeight
      };
    }, { vpName: viewportName, mobileFlag: isMobile });

    // 3. Format and output results cleanly
    console.log(`\n🔴 CRITICAL FINDINGS (${auditResults.criticalFindings.length}):`);
    if (auditResults.criticalFindings.length === 0) {
      console.log(`  ✓ None detected.`);
    } else {
      auditResults.criticalFindings.forEach((f, i) => {
        console.log(`  [${i + 1}] Viewport: ${f.viewport}`);
        console.log(`      Element:  ${f.element}`);
        console.log(`      Issue:    ${f.issue}`);
        console.log(`      Severity: ${f.severity}`);
      });
    }

    console.log(`\n🟡 WARNING FINDINGS (${auditResults.warningFindings.length}):`);
    if (auditResults.warningFindings.length === 0) {
      console.log(`  ✓ None detected.`);
    } else {
      auditResults.warningFindings.forEach((f, i) => {
        console.log(`  [${i + 1}] Category: ${f.category}`);
        console.log(`      Element:  ${f.element}`);
        console.log(`      Issue:    ${f.issue}`);
      });
    }

    console.log(`\nℹ️ INFORMATIONAL FINDINGS (${auditResults.infoFindings.length}):`);
    auditResults.infoFindings.slice(0, 4).forEach((f, i) => {
      console.log(`  [${i + 1}] Category: ${f.category} -> ${f.element}`);
    });

    // 4. Capture screenshot
    const screenshotPath = `tests/screenshots/${viewportName.replace(/ /g, '_')}_baseline.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`\n📸 Screenshot saved to: ${screenshotPath}`);

    // 5. Assert zero critical layout-breaking failures
    expect(auditResults.criticalFindings.length, `Critical UI/layout failures detected on ${viewportName}`).toBe(0);
  });
});
