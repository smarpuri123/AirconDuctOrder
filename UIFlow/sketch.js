// Full-Screen Relation Diagram Infographic in p5.js (Text-free, responsive full viewport)

// Color Palette sampled directly from the reference infographic
const COLORS = {
  bg: '#FBFBFB',

  // Left Arc & Scene Left Block (Plan Categories)
  planed:    '#1D88C4', // Blue
  expected:  '#F3B72B', // Yellow / Gold
  adaptable: '#6E2585', // Deep Purple
  unplaned:  '#42A748', // Green

  // Scene Right Block & Character Connections (Scene Categories)
  investigating: '#94C93D', // Lime Green
  planing:       '#A366A8', // Lavender Purple
  action:        '#EE6B33'  // Coral Orange
};

// 4 Plan Categories on the Left Arc
const PLAN_CATEGORIES = [
  { id: 'planed',    color: COLORS.planed },
  { id: 'expected',  color: COLORS.expected },
  { id: 'adaptable', color: COLORS.adaptable },
  { id: 'unplaned',  color: COLORS.unplaned }
];

// 12 Character Groups on the Right Column
const NUM_CHARACTERS = 12;

// 36 Scenes along the Middle Arc (top to bottom)
// weight: 3 = Major Influence, 2 = Some Influence, 1 = Little Influence
const SCENES = [
  // Investigating Scenes (1 - 14)
  { plan: 'planed',    type: 'investigating', weight: 1, chars: [10] },
  { plan: 'adaptable', type: 'investigating', weight: 2, chars: [3, 5, 8, 10, 11] },
  { plan: 'adaptable', type: 'investigating', weight: 1, chars: [6] },
  { plan: 'planed',    type: 'investigating', weight: 2, chars: [2, 10] },
  { plan: 'unplaned',  type: 'investigating', weight: 3, chars: [0] },
  { plan: 'unplaned',  type: 'investigating', weight: 2, chars: [0, 6] },
  { plan: 'unplaned',  type: 'investigating', weight: 2, chars: [0, 6] },
  { plan: 'unplaned',  type: 'investigating', weight: 1, chars: [2, 6] },
  { plan: 'adaptable', type: 'investigating', weight: 3, chars: [2, 10] },
  { plan: 'expected',  type: 'investigating', weight: 3, chars: [2, 10] },
  { plan: 'expected',  type: 'investigating', weight: 3, chars: [2, 3, 10] },
  { plan: 'unplaned',  type: 'investigating', weight: 2, chars: [10] },
  { plan: 'unplaned',  type: 'investigating', weight: 2, chars: [2, 10] },
  { plan: 'unplaned',  type: 'investigating', weight: 1, chars: [6] },

  // Planing Scenes (15 - 21)
  { plan: 'planed',    type: 'planing',       weight: 2, chars: [3, 5, 8, 10, 11] },
  { plan: 'planed',    type: 'planing',       weight: 3, chars: [3, 10] },
  { plan: 'planed',    type: 'planing',       weight: 2, chars: [3, 5, 8, 9, 10, 11] },
  { plan: 'planed',    type: 'planing',       weight: 2, chars: [3, 5, 8, 9, 10, 11] },
  { plan: 'planed',    type: 'planing',       weight: 3, chars: [3, 5, 7, 8, 10, 11] },
  { plan: 'planed',    type: 'planing',       weight: 3, chars: [3, 5, 7, 8, 10, 11] },
  { plan: 'planed',    type: 'planing',       weight: 2, chars: [3, 8, 10, 11] },

  // Action Scenes (22 - 36)
  { plan: 'planed',    type: 'action',        weight: 2, chars: [3, 5, 8, 10, 11] },
  { plan: 'planed',    type: 'action',        weight: 2, chars: [3, 5, 8, 10, 11] },
  { plan: 'planed',    type: 'action',        weight: 2, chars: [3, 5, 8, 10, 11] },
  { plan: 'adaptable', type: 'action',        weight: 2, chars: [3, 5, 8, 10, 11] },
  { plan: 'adaptable', type: 'action',        weight: 2, chars: [3, 5, 7, 8, 10, 11] },
  { plan: 'adaptable', type: 'action',        weight: 2, chars: [5] },
  { plan: 'expected',  type: 'action',        weight: 3, chars: [3, 7, 8, 10, 11] },
  { plan: 'expected',  type: 'action',        weight: 2, chars: [3, 7, 8, 10, 11] },
  { plan: 'expected',  type: 'action',        weight: 2, chars: [3, 4, 7] },
  { plan: 'adaptable', type: 'action',        weight: 1, chars: [3, 10] },
  { plan: 'adaptable', type: 'action',        weight: 1, chars: [11] },
  { plan: 'planed',    type: 'action',        weight: 1, chars: [11] },
  { plan: 'planed',    type: 'action',        weight: 2, chars: [1] },
  { plan: 'planed',    type: 'action',        weight: 2, chars: [3] },
  { plan: 'planed',    type: 'action',        weight: 1, chars: [10] }
];

let layoutData = null;
let hoverState = null; // { kind: 'plan'|'scene'|'char', index: number }

function setup() {
  const cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent('canvas-container');
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  computeLayout();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  computeLayout();
}

function computeLayout() {
  const W = width;
  const H = height;
  const scaleH = H / 1000;

  // 1. Middle Arc Geometry (36 scene dual-blocks spanning 92% of screen height)
  const midCy = H * 0.50;
  const midHalfH = H * 0.45;
  const midXEnds = W * 0.27;
  const midXPeak = W * 0.39;
  const midSagitta = Math.max(30, midXPeak - midXEnds);

  const midRMid = (midHalfH * midHalfH + midSagitta * midSagitta) / (2 * midSagitta);
  const midCx = midXPeak - midRMid;
  const blockHalfWidth = constrain(W * 0.015, 14, 28);
  const midRInner = midRMid - blockHalfWidth;
  const midROuter = midRMid + blockHalfWidth;

  const maxMidAngle = Math.asin(constrain(midHalfH / midRMid, -0.95, 0.95));
  const startAngle = -maxMidAngle;
  const endAngle   =  maxMidAngle;
  const totalSpan  = endAngle - startAngle;
  const nScenes    = SCENES.length;
  const stepAngle  = totalSpan / nScenes;
  const blockSpan  = stepAngle * 0.74;

  const sceneNodes = SCENES.map((s, idx) => {
    const aCenter = startAngle + (idx + 0.5) * stepAngle;
    const a0 = aCenter - blockSpan / 2;
    const a1 = aCenter + blockSpan / 2;

    // Influence thickness arriving at the inner edge of the scene's left block
    let weightFrac = 0.28;
    if (s.weight === 3) weightFrac = 0.98;
    else if (s.weight === 2) weightFrac = 0.60;

    const wSpan = blockSpan * weightFrac;
    const wa0 = aCenter - wSpan / 2;
    const wa1 = aCenter + wSpan / 2;

    return {
      ...s,
      index: idx,
      aCenter,
      a0,
      a1,
      wa0,
      wa1,
      planColor: COLORS[s.plan],
      typeColor: COLORS[s.type]
    };
  });

  // 2. Left Arc Geometry (4 Plan Categories near left edge of screen)
  const leftCy = H * 0.50;
  const leftHalfH = H * 0.235;
  const leftXEnds = W * 0.04;
  const leftXPeak = W * 0.092;
  const leftSagitta = Math.max(15, leftXPeak - leftXEnds);

  const leftRBarInner = (leftHalfH * leftHalfH + leftSagitta * leftSagitta) / (2 * leftSagitta);
  const leftCx = leftXPeak - leftRBarInner;
  const leftBarThick = Math.max(4, W * 0.004);
  const leftRBarOuter = leftRBarInner + leftBarThick;
  const leftRRibbonStart = leftRBarOuter + Math.max(4, W * 0.0035);

  const maxLeftAngle = Math.asin(constrain(leftHalfH / leftRBarInner, -0.95, 0.95));
  const leftStartAngle = -maxLeftAngle;
  const leftEndAngle   =  maxLeftAngle;
  const leftTotalSpan  = leftEndAngle - leftStartAngle;
  const leftGapAngle   = leftTotalSpan * 0.022;
  const usableLeftSpan = leftTotalSpan - leftGapAngle * (PLAN_CATEGORIES.length - 1);

  // Group scenes by Plan category in top-to-bottom order
  const planGroups = {};
  PLAN_CATEGORIES.forEach(p => { planGroups[p.id] = []; });
  sceneNodes.forEach(sn => {
    const wVal = sn.weight === 3 ? 3.1 : (sn.weight === 2 ? 1.85 : 0.9);
    planGroups[sn.plan].push({ scene: sn, wVal });
  });

  const categoryFracs = {
    planed:    0.375,
    expected:  0.175,
    adaptable: 0.215,
    unplaned:  0.235
  };

  let curLeftAngle = leftStartAngle;
  const leftCategories = PLAN_CATEGORIES.map((p, pIdx) => {
    const span = usableLeftSpan * categoryFracs[p.id];
    const a0 = curLeftAngle;
    const a1 = curLeftAngle + span;
    curLeftAngle = a1 + leftGapAngle;

    const items = planGroups[p.id];
    const sumW = items.reduce((acc, it) => acc + it.wVal, 0);

    let subA = a0;
    items.forEach(it => {
      const subSpan = span * (it.wVal / sumW);
      it.scene.leftA0 = subA;
      it.scene.leftA1 = subA + subSpan;
      it.scene.leftACenter = subA + subSpan / 2;
      subA += subSpan;
    });

    return {
      ...p,
      index: pIdx,
      a0,
      a1,
      aCenter: (a0 + a1) / 2
    };
  });

  // 3. Right Column Character Stacks (spanning right side of screen)
  const charX = W * 0.935;
  const charBarW = Math.max(18, W * 0.022);

  const charLinks = Array.from({ length: NUM_CHARACTERS }, () => []);
  sceneNodes.forEach(sn => {
    sn.chars.forEach(cIdx => {
      charLinks[cIdx].push(sn);
    });
  });

  // Normalized vertical positions of the 12 character stacks spanning 6% to 94% height
  const charYFracs = [
    0.065, // 0
    0.145, // 1
    0.220, // 2
    0.305, // 3
    0.390, // 4
    0.472, // 5
    0.558, // 6
    0.642, // 7
    0.724, // 8
    0.812, // 9
    0.885, // 10
    0.945  // 11
  ];

  const stripPitch = Math.max(2.0, 2.9 * scaleH);
  const stripThick = stripPitch * 0.78;

  const charNodes = charYFracs.map((yFrac, cIdx) => {
    const links = charLinks[cIdx];
    const totalH = links.length * stripPitch;
    const centerY = H * yFrac;
    const startY = centerY - totalH / 2;

    return {
      index: cIdx,
      x: charX,
      centerY,
      startY,
      totalH,
      count: links.length
    };
  });

  // 4. Build Scene-to-Character horizontal shelves and Bezier connections
  const charSlotCounters = Array.from({ length: NUM_CHARACTERS }, () => 0);
  const rightConnections = [];
  const shelfRunLength = W * 0.135; // Horizontal shelf run before fanning out
  const linePitch = Math.max(1.7, 2.35 * scaleH);

  sceneNodes.forEach(sn => {
    const k = sn.chars.length;

    const xOuterTop = midCx + midROuter * Math.cos(sn.a0);
    const yOuterTop = midCy + midROuter * Math.sin(sn.a0);
    const xOuterBot = midCx + midROuter * Math.cos(sn.a1);
    const yOuterBot = midCy + midROuter * Math.sin(sn.a1);
    const xOuterMid = midCx + midROuter * Math.cos(sn.aCenter);

    const shelfEndX = xOuterMid + shelfRunLength;
    const yBottomLine = yOuterBot - 1.0 * scaleH;
    const yTopLine = yBottomLine - (k - 1) * linePitch;

    sn.xOuterTop = xOuterTop;
    sn.yOuterTop = yOuterTop;
    sn.xOuterBot = xOuterBot;
    sn.yOuterBot = yOuterBot;
    sn.shelfEndX = shelfEndX;
    sn.yBottomLine = yBottomLine;
    sn.yTopLine = yTopLine;

    sn.chars.forEach((cIdx, localIdx) => {
      const slotIdx = charSlotCounters[cIdx]++;
      const cn = charNodes[cIdx];
      const targetY = cn.startY + (slotIdx + 0.5) * stripPitch;

      const sy = yTopLine + localIdx * linePitch;
      const tEdge = constrain((sy - yOuterTop) / (yOuterBot - yOuterTop || 1), 0, 1);
      const sx = lerp(xOuterTop, xOuterBot, tEdge) - 0.5;

      rightConnections.push({
        scene: sn,
        charIndex: cIdx,
        localIdx,
        sx,
        sy,
        shelfEndX,
        targetX: charX,
        targetY,
        color: sn.typeColor
      });
    });
  });

  layoutData = {
    midCx,
    midCy,
    midRInner,
    midRMid,
    midROuter,
    leftCx,
    leftCy,
    leftRBarInner,
    leftRBarOuter,
    leftRRibbonStart,
    sceneNodes,
    leftCategories,
    charNodes,
    rightConnections,
    stripThick,
    charBarW
  };
}

function draw() {
  background(COLORS.bg);

  drawLeftToMidRibbons();
  drawLeftArcCategories();
  drawMidToRightConnections();
  drawMiddleArcBlocks();
}

function isSceneHighlighted(sn) {
  if (!hoverState) return true;
  if (hoverState.kind === 'scene') return hoverState.index === sn.index;
  if (hoverState.kind === 'plan') return sn.plan === PLAN_CATEGORIES[hoverState.index].id;
  if (hoverState.kind === 'char') return sn.chars.includes(hoverState.index);
  return true;
}

function drawLeftToMidRibbons() {
  const { leftCx, leftCy, leftRRibbonStart, midCx, midCy, midRInner, sceneNodes } = layoutData;

  push();
  noStroke();

  sceneNodes.forEach(sn => {
    const active = isSceneHighlighted(sn);
    const alpha = hoverState ? (active ? 215 : 28) : 162;

    const c = color(sn.planColor);
    c.setAlpha(alpha);
    fill(c);

    // Source endpoints on Left Arc
    const x0Top = leftCx + leftRRibbonStart * Math.cos(sn.leftA0);
    const y0Top = leftCy + leftRRibbonStart * Math.sin(sn.leftA0);
    const x0Bot = leftCx + leftRRibbonStart * Math.cos(sn.leftA1);
    const y0Bot = leftCy + leftRRibbonStart * Math.sin(sn.leftA1);

    // Target endpoints on Middle Arc inner edge (using weight-adjusted wa0..wa1)
    const x1Top = midCx + (midRInner + 0.5) * Math.cos(sn.wa0);
    const y1Top = midCy + (midRInner + 0.5) * Math.sin(sn.wa0);
    const x1Bot = midCx + (midRInner + 0.5) * Math.cos(sn.wa1);
    const y1Bot = midCy + (midRInner + 0.5) * Math.sin(sn.wa1);

    // Smooth radial control points
    const chordDist = dist(x0Top, y0Top, x1Top, y1Top);
    const t0 = chordDist * 0.44;
    const t1 = chordDist * 0.44;

    const c0TopX = x0Top + t0 * Math.cos(sn.leftA0);
    const c0TopY = y0Top + t0 * Math.sin(sn.leftA0);
    const c1TopX = x1Top - t1 * Math.cos(sn.wa0);
    const c1TopY = y1Top - t1 * Math.sin(sn.wa0);

    const c1BotX = x1Bot - t1 * Math.cos(sn.wa1);
    const c1BotY = y1Bot - t1 * Math.sin(sn.wa1);
    const c0BotX = x0Bot + t0 * Math.cos(sn.leftA1);
    const c0BotY = y0Bot + t0 * Math.sin(sn.leftA1);

    beginShape();
    vertex(x0Top, y0Top);
    bezierVertex(c0TopX, c0TopY, c1TopX, c1TopY, x1Top, y1Top);
    vertex(x1Bot, y1Bot);
    bezierVertex(c1BotX, c1BotY, c0BotX, c0BotY, x0Bot, y0Bot);
    endShape(CLOSE);
  });

  pop();
}

function drawLeftArcCategories() {
  const { leftCx, leftCy, leftRBarInner, leftRBarOuter, leftCategories } = layoutData;

  push();
  noStroke();
  leftCategories.forEach(cat => {
    const active = !hoverState ||
      (hoverState.kind === 'plan' && hoverState.index === cat.index) ||
      (hoverState.kind === 'scene' && SCENES[hoverState.index].plan === cat.id);

    const c = color(cat.color);
    c.setAlpha(active ? 255 : 65);
    fill(c);

    // Thin solid inner arc strip
    drawArcBand(leftCx, leftCy, leftRBarInner, leftRBarOuter, cat.a0, cat.a1, 24);
  });
  pop();
}

function drawMiddleArcBlocks() {
  const { midCx, midCy, midRInner, midRMid, midROuter, sceneNodes } = layoutData;

  push();
  noStroke();

  sceneNodes.forEach(sn => {
    const active = isSceneHighlighted(sn);

    // Left Half-Block (Plan Category)
    const cPlan = color(sn.planColor);
    cPlan.setAlpha(active ? 255 : 55);
    fill(cPlan);
    drawArcBand(midCx, midCy, midRInner, midRMid - 0.6, sn.a0, sn.a1, 8);

    // Right Half-Block (Scene Type Category)
    const cType = color(sn.typeColor);
    cType.setAlpha(active ? 255 : 55);
    fill(cType);
    drawArcBand(midCx, midCy, midRMid + 0.6, midROuter, sn.a0, sn.a1, 8);
  });

  pop();
}

function drawMidToRightConnections() {
  const { rightConnections, stripThick, charBarW } = layoutData;

  push();
  noFill();
  strokeCap(SQUARE);

  rightConnections.forEach(conn => {
    const sn = conn.scene;
    let active = isSceneHighlighted(sn);
    if (hoverState && hoverState.kind === 'char') {
      active = conn.charIndex === hoverState.index;
    }

    const alpha = hoverState ? (active ? 235 : 24) : 192;
    const c = color(conn.color);
    c.setAlpha(alpha);

    stroke(c);
    strokeWeight(stripThick);

    const x0 = conn.sx;
    const y0 = conn.sy;
    const xShelf = conn.shelfEndX;
    const x1 = conn.targetX;
    const y1 = conn.targetY;

    const dx = x1 - xShelf;
    const cp1x = xShelf + dx * 0.45;
    const cp1y = y0;
    const cp2x = x1 - dx * 0.44;
    const cp2y = y1;

    // Continuous path: horizontal shelf segment -> smooth S-curve -> right character bar
    beginShape();
    vertex(x0, y0);
    vertex(xShelf, y0);
    bezierVertex(cp1x, cp1y, cp2x, cp2y, x1, y1);
    vertex(x1 + charBarW, y1);
    endShape();
  });

  pop();
}

// Helper to draw an annular sector (arc band)
function drawArcBand(cx, cy, rInner, rOuter, a0, a1, steps = 16) {
  beginShape();
  for (let i = 0; i <= steps; i++) {
    const a = lerp(a0, a1, i / steps);
    vertex(cx + rOuter * Math.cos(a), cy + rOuter * Math.sin(a));
  }
  for (let i = steps; i >= 0; i--) {
    const a = lerp(a0, a1, i / steps);
    vertex(cx + rInner * Math.cos(a), cy + rInner * Math.sin(a));
  }
  endShape(CLOSE);
}

// Interactive hover highlighting across the 3-tier flow diagram
function mouseMoved() {
  if (!layoutData) return;
  const {
    leftCx, leftCy, leftRBarInner, leftRRibbonStart,
    midCx, midCy, midRInner, midROuter,
    leftCategories, sceneNodes, charNodes, charBarW
  } = layoutData;

  const ldx = mouseX - leftCx;
  const ldy = mouseY - leftCy;
  const lr = Math.sqrt(ldx * ldx + ldy * ldy);
  const la = Math.atan2(ldy, ldx);

  const mdx = mouseX - midCx;
  const mdy = mouseY - midCy;
  const mr = Math.sqrt(mdx * mdx + mdy * mdy);
  const ma = Math.atan2(mdy, mdx);

  let found = null;

  // 1. Check Left Arc Categories
  for (const cat of leftCategories) {
    const inArc = lr >= leftRBarInner - 12 && lr <= leftRRibbonStart + 45 && la >= cat.a0 && la <= cat.a1;
    if (inArc) {
      found = { kind: 'plan', index: cat.index };
      break;
    }
  }

  // 2. Check Middle Arc Scene Blocks or Horizontal Shelves
  if (!found) {
    for (const sn of sceneNodes) {
      const inArc = mr >= midRInner - 4 && mr <= midROuter + 4 && ma >= sn.a0 && ma <= sn.a1;
      const inShelf = (
        mouseX >= sn.xOuterTop &&
        mouseX <= sn.shelfEndX &&
        mouseY >= sn.yTopLine - 6 &&
        mouseY <= sn.yBottomLine + 6
      );
      if (inArc || inShelf) {
        found = { kind: 'scene', index: sn.index };
        break;
      }
    }
  }

  // 3. Check Right Column Character Stacks
  if (!found) {
    for (const cn of charNodes) {
      const halfH = Math.max(12, cn.totalH / 2 + 4);
      if (
        mouseX >= cn.x - 10 &&
        mouseX <= cn.x + charBarW + 15 &&
        mouseY >= cn.centerY - halfH &&
        mouseY <= cn.centerY + halfH
      ) {
        found = { kind: 'char', index: cn.index };
        break;
      }
    }
  }

  hoverState = found;
  cursor(hoverState ? HAND : ARROW);
}
