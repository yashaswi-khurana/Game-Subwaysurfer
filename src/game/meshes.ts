import * as THREE from 'three';
import { CharacterSkin, PowerUpType } from './types';

// Cached procedural textures so we allocate once and run at locked 60fps
let hazardTextureCache: THREE.CanvasTexture | null = null;
let rampTextureCache: THREE.CanvasTexture | null = null;
const graffitiTexturesCache: THREE.CanvasTexture[] = [];

export function getHazardStripeTexture(): THREE.CanvasTexture {
  if (hazardTextureCache) return hazardTextureCache;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 64);

  ctx.fillStyle = '#ef4444';
  for (let x = -64; x < 320; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 24, 0);
    ctx.lineTo(x + 56, 64);
    ctx.lineTo(x + 32, 64);
    ctx.closePath();
    ctx.fill();
  }
  // Top & bottom dark trim
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 5);
  ctx.fillRect(0, 59, 256, 5);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  hazardTextureCache = tex;
  return tex;
}

export function getRampChevronTexture(): THREE.CanvasTexture {
  if (rampTextureCache) return rampTextureCache;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 128, 256);

  // Side yellow safety rails
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, 12, 256);
  ctx.fillRect(116, 0, 12, 256);

  // Upward glowing chevrons
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let y = 45; y < 245; y += 52) {
    ctx.beginPath();
    ctx.moveTo(28, y + 22);
    ctx.lineTo(64, y);
    ctx.lineTo(100, y + 22);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  rampTextureCache = tex;
  return tex;
}

export function getGraffitiSideTexture(variant: number): THREE.CanvasTexture {
  const idx = Math.abs(variant) % 4;
  if (graffitiTexturesCache[idx]) return graffitiTexturesCache[idx];

  const palettes = [
    { body: '#1d4ed8', stripe: '#facc15', tag1: '#f43f5e', tag2: '#22d3ee', word: 'METRO' },
    { body: '#dc2626', stripe: '#f8fafc', tag1: '#a3e635', tag2: '#c084fc', word: 'SURF!' },
    { body: '#059669', stripe: '#fde047', tag1: '#fb923c', tag2: '#38bdf8', word: 'FRESH' },
    { body: '#7c3aed', stripe: '#22d3ee', tag1: '#facc15', tag2: '#f43f5e', word: 'DASH' },
  ];

  const pal = palettes[idx];
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Train metallic body
  ctx.fillStyle = pal.body;
  ctx.fillRect(0, 0, 512, 256);

  // Metallic lower ribbing
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 185; y < 248; y += 12) {
    ctx.fillRect(0, y, 512, 5);
  }

  // Horizontal accent stripe
  ctx.fillStyle = pal.stripe;
  ctx.fillRect(0, 128, 512, 18);

  // Windows row
  for (let x = 24; x < 480; x += 78) {
    // Doors vs windows
    if (x === 180 || x === 336) {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x, 42, 52, 195);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + 6, 52, 18, 72);
      ctx.fillRect(x + 28, 52, 18, 72);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(x, 46, 58, 66, 8);
      ctx.fill();
      // Window sky reflection
      ctx.fillStyle = 'rgba(125, 211, 252, 0.28)';
      ctx.beginPath();
      ctx.moveTo(x + 8, 52);
      ctx.lineTo(x + 28, 52);
      ctx.lineTo(x + 14, 106);
      ctx.lineTo(x + 8, 106);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Colorful street-art graffiti throw-up along the lower side panel!
  ctx.save();
  ctx.translate(256, 182);
  ctx.rotate(-0.04);

  // Paint splatter circles
  ctx.fillStyle = pal.tag2;
  for (let i = 0; i < 9; i++) {
    const sx = (i - 4) * 34;
    const sy = Math.sin(i * 1.9) * 16;
    ctx.beginPath();
    ctx.arc(sx, sy, 22 + (i % 3) * 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.font = '900 54px Impact, Arial Black, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#090d16';
  ctx.strokeText(pal.word, 0, 4);
  ctx.fillStyle = pal.tag1;
  ctx.fillText(pal.word, 0, 4);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  graffitiTexturesCache[idx] = tex;
  return tex;
}

export interface RunnerRig {
  group: THREE.Group;
  bodyPivot: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  hoverboard: THREE.Group;
  jetpack: THREE.Group;
  sprayCan: THREE.Group;
  superShoeLeft: THREE.Mesh;
  superShoeRight: THREE.Mesh;
  magnetHalo: THREE.Mesh;
  applySkin: (skin: CharacterSkin) => void;
}

export function createRunnerRig(initialSkin: CharacterSkin): RunnerRig {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);

  const hoodieMat = new THREE.MeshStandardMaterial({ color: initialSkin.hoodieColor, roughness: 0.55 });
  const vestMat = new THREE.MeshStandardMaterial({ color: initialSkin.vestColor, roughness: 0.5 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: initialSkin.pantsColor, roughness: 0.65 });
  const capMat = new THREE.MeshStandardMaterial({ color: initialSkin.capColor, roughness: 0.45 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: initialSkin.shoeColor, roughness: 0.4 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#f6c39b', roughness: 0.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.25 });
  const boardMat = new THREE.MeshStandardMaterial({
    color: initialSkin.boardColor,
    roughness: 0.25,
    metalness: 0.3,
  });
  const boardGlowMat = new THREE.MeshStandardMaterial({
    color: initialSkin.boardGlow,
    emissive: initialSkin.boardGlow,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });

  // Torso (Hoodie + Street Vest)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.38), hoodieMat);
  torso.position.y = 1.06;
  torso.castShadow = true;
  bodyPivot.add(torso);

  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.56, 0.42), vestMat);
  vest.position.y = 1.08;
  vest.castShadow = true;
  bodyPivot.add(vest);

  // Backpack
  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.48, 0.22),
    new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.6 })
  );
  backpack.position.set(0, 1.08, 0.28);
  bodyPivot.add(backpack);

  // Head + Sunglasses + Backwards Baseball Cap
  const head = new THREE.Group();
  head.position.set(0, 1.66, 0);
  bodyPivot.add(head);

  const headCube = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.48, 0.5), skinMat);
  headCube.castShadow = true;
  head.add(headCube);

  // Cool street shades facing forward (-Z when running, +Z when facing camera)
  const shades = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.13, 0.54), darkMat);
  shades.position.set(0, 0.03, 0);
  head.add(shades);

  // Cap dome + backwards brim
  const capDome = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.22, 0.54), capMat);
  capDome.position.set(0, 0.22, 0);
  head.add(capDome);

  const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.28), capMat);
  capBrim.position.set(0, 0.15, 0.36); // Backwards brim!
  head.add(capBrim);

  // Arms
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.44, 1.34, 0);
  bodyPivot.add(leftArm);
  const lSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.22), hoodieMat);
  lSleeve.position.y = -0.22;
  leftArm.add(lSleeve);
  const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.18), skinMat);
  lHand.position.y = -0.52;
  leftArm.add(lHand);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.44, 1.34, 0);
  bodyPivot.add(rightArm);
  const rSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.22), hoodieMat);
  rSleeve.position.y = -0.22;
  rightArm.add(rSleeve);
  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.18), skinMat);
  rHand.position.y = -0.52;
  rightArm.add(rHand);

  // Spray-paint can in right hand (shown on Start Screen!)
  const sprayCan = new THREE.Group();
  sprayCan.position.set(0, -0.56, -0.14);
  const canBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.24, 10),
    new THREE.MeshStandardMaterial({ color: '#ec4899', metalness: 0.4, roughness: 0.3 })
  );
  canBody.rotation.x = Math.PI / 2;
  sprayCan.add(canBody);
  rightArm.add(sprayCan);

  // Legs + Chunky Sneakers + Super Sneakers attachment
  const superShoeMat = new THREE.MeshStandardMaterial({
    color: '#84cc16',
    emissive: '#4d7c0f',
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.18, 0.72, 0);
  bodyPivot.add(leftLeg);
  const lPant = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.54, 0.26), pantsMat);
  lPant.position.y = -0.26;
  leftLeg.add(lPant);
  const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.38), shoeMat);
  lShoe.position.set(0, -0.6, -0.05);
  leftLeg.add(lShoe);
  const superShoeLeft = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.52), superShoeMat);
  superShoeLeft.position.set(0, -0.62, -0.05);
  superShoeLeft.visible = false;
  leftLeg.add(superShoeLeft);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.18, 0.72, 0);
  bodyPivot.add(rightLeg);
  const rPant = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.54, 0.26), pantsMat);
  rPant.position.y = -0.26;
  rightLeg.add(rPant);
  const rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.38), shoeMat);
  rShoe.position.set(0, -0.6, -0.05);
  rightLeg.add(rShoe);
  const superShoeRight = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.52), superShoeMat);
  superShoeRight.position.set(0, -0.62, -0.05);
  superShoeRight.visible = false;
  rightLeg.add(superShoeRight);

  // Neon Hoverboard under feet
  const hoverboard = new THREE.Group();
  hoverboard.position.set(0, 0.08, 0);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.09, 1.75), boardMat);
  deck.castShadow = true;
  hoverboard.add(deck);
  const railLeft = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 1.55), boardGlowMat);
  railLeft.position.set(-0.45, 0, 0);
  hoverboard.add(railLeft);
  const railRight = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 1.55), boardGlowMat);
  railRight.position.set(0.45, 0, 0);
  hoverboard.add(railRight);
  hoverboard.visible = false;
  group.add(hoverboard);

  // Dual Spray-Can Jetpack on back
  const jetpack = new THREE.Group();
  jetpack.position.set(0, 1.12, 0.34);
  const tankMat1 = new THREE.MeshStandardMaterial({ color: '#06b6d4', metalness: 0.4, roughness: 0.25 });
  const tankMat2 = new THREE.MeshStandardMaterial({ color: '#f97316', metalness: 0.4, roughness: 0.25 });
  const tankL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.62, 12), tankMat1);
  tankL.position.x = -0.15;
  jetpack.add(tankL);
  const tankR = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.62, 12), tankMat2);
  tankR.position.x = 0.15;
  jetpack.add(tankR);
  jetpack.visible = false;
  bodyPivot.add(jetpack);

  // Magnet aura ring around runner when Coin Magnet is active
  const magnetHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.045, 8, 28),
    new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.75 })
  );
  magnetHalo.rotation.x = Math.PI / 2;
  magnetHalo.position.y = 0.9;
  magnetHalo.visible = false;
  group.add(magnetHalo);

  const applySkin = (skin: CharacterSkin) => {
    hoodieMat.color.set(skin.hoodieColor);
    vestMat.color.set(skin.vestColor);
    pantsMat.color.set(skin.pantsColor);
    capMat.color.set(skin.capColor);
    shoeMat.color.set(skin.shoeColor);
    boardMat.color.set(skin.boardColor);
    boardGlowMat.color.set(skin.boardGlow);
    boardGlowMat.emissive.set(skin.boardGlow);
  };

  return {
    group,
    bodyPivot,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    hoverboard,
    jetpack,
    sprayCan,
    superShoeLeft,
    superShoeRight,
    magnetHalo,
    applySkin,
  };
}

export interface InspectorRig {
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  dogGroup: THREE.Group;
}

export function createInspectorRig(): InspectorRig {
  const group = new THREE.Group();

  const uniformMat = new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.6 });
  const darkBlueMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.5 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#f1b894', roughness: 0.6 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.6, roughness: 0.25 });

  // Stout inspector torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.78, 0.52), uniformMat);
  torso.position.y = 1.08;
  torso.castShadow = true;
  group.add(torso);

  // Gold badge
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.05), goldMat);
  badge.position.set(-0.18, 1.24, -0.27);
  group.add(badge);

  // Head + Mustache + Officer Cap
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.5, 0.5), skinMat);
  head.position.set(0, 1.72, 0);
  group.add(head);

  const mustache = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.1, 0.1),
    new THREE.MeshStandardMaterial({ color: '#78350f' })
  );
  mustache.position.set(0, 1.62, -0.26);
  group.add(mustache);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.2, 12), uniformMat);
  cap.position.set(0, 2.02, 0);
  group.add(cap);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.25), darkBlueMat);
  visor.position.set(0, 1.94, -0.24);
  group.add(visor);

  // Arms + Baton
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.5, 1.36, 0);
  const lSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.52, 0.24), uniformMat);
  lSleeve.position.y = -0.22;
  leftArm.add(lSleeve);
  group.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.5, 1.36, 0);
  const rSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.52, 0.24), uniformMat);
  rSleeve.position.y = -0.22;
  rightArm.add(rSleeve);
  const baton = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.52, 8), darkBlueMat);
  baton.rotation.x = Math.PI / 3;
  baton.position.set(0, -0.5, -0.18);
  rightArm.add(baton);
  group.add(rightArm);

  // Legs
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.2, 0.68, 0);
  const lLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.64, 0.28), darkBlueMat);
  lLegMesh.position.y = -0.32;
  leftLeg.add(lLegMesh);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.2, 0.68, 0);
  const rLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.64, 0.28), darkBlueMat);
  rLegMesh.position.y = -0.32;
  rightLeg.add(rLegMesh);
  group.add(rightLeg);

  // Guard Dog running right beside him!
  const dogGroup = new THREE.Group();
  dogGroup.position.set(0.82, 0, 0.15);
  const furMat = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.7 });
  const collarMat = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.4 });

  const dogBody = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.62), furMat);
  dogBody.position.y = 0.36;
  dogBody.castShadow = true;
  dogGroup.add(dogBody);

  const dogHead = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.32), furMat);
  dogHead.position.set(0, 0.56, -0.32);
  dogGroup.add(dogHead);

  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.34), collarMat);
  collar.position.set(0, 0.44, -0.26);
  dogGroup.add(collar);

  // 4 little legs
  const legPositions = [
    [-0.11, 0.16, -0.2],
    [0.11, 0.16, -0.2],
    [-0.11, 0.16, 0.2],
    [0.11, 0.16, 0.2],
  ];
  legPositions.forEach(([lx, ly, lz]) => {
    const dLeg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.26, 0.09), furMat);
    dLeg.position.set(lx, ly, lz);
    dogGroup.add(dLeg);
  });

  group.add(dogGroup);

  return { group, leftLeg, rightLeg, leftArm, rightArm, dogGroup };
}

export const TRAIN_WIDTH = 2.24;
export const TRAIN_HEIGHT = 2.65;
export const TRAIN_LENGTH = 14.5;
export const RAMP_LENGTH = 5.4;

export function createTrainCarMesh(variant: number, isMoving: boolean, hasRamp: boolean): THREE.Group {
  const group = new THREE.Group();
  const sideTex = getGraffitiSideTexture(variant);

  const roofColors = ['#e2e8f0', '#cbd5e1', '#e2e8f0', '#ddd6fe'];
  const frontColors = ['#1d4ed8', '#dc2626', '#059669', '#7c3aed'];
  const idx = Math.abs(variant) % 4;

  const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.45 });
  const roofMat = new THREE.MeshStandardMaterial({ color: roofColors[idx], roughness: 0.6, metalness: 0.2 });
  const frontMat = new THREE.MeshStandardMaterial({ color: frontColors[idx], roughness: 0.4 });
  const underMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 });

  // Box materials order: +X, -X, +Y (roof), -Y, +Z (front facing runner!), -Z (back)
  const carMesh = new THREE.Mesh(
    new THREE.BoxGeometry(TRAIN_WIDTH, TRAIN_HEIGHT - 0.18, TRAIN_LENGTH),
    [sideMat, sideMat, roofMat, underMat, frontMat, frontMat]
  );
  carMesh.position.y = (TRAIN_HEIGHT - 0.18) / 2 + 0.18;
  carMesh.castShadow = true;
  carMesh.receiveShadow = true;
  group.add(carMesh);

  // Dark undercarriage bogies
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(TRAIN_WIDTH - 0.35, 0.22, TRAIN_LENGTH - 0.8),
    underMat
  );
  chassis.position.y = 0.12;
  group.add(chassis);

  // Front windshield (+Z face faces the player who runs toward -Z!)
  const windshield = new THREE.Mesh(
    new THREE.PlaneGeometry(TRAIN_WIDTH - 0.36, 0.88),
    new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.15, metalness: 0.6 })
  );
  windshield.position.set(0, 1.88, TRAIN_LENGTH / 2 + 0.015);
  group.add(windshield);

  // Illuminated LED destination sign at top of front face
  const destColor = isMoving ? '#f97316' : '#38bdf8';
  const destBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, 0.22),
    new THREE.MeshBasicMaterial({ color: destColor })
  );
  destBoard.position.set(0, 2.46, TRAIN_LENGTH / 2 + 0.02);
  group.add(destBoard);

  // Headlights (extra bright glowing yellow/red warning lights on moving trains!)
  const headlightMat = new THREE.MeshBasicMaterial({
    color: isMoving ? '#fef08a' : '#cbd5e1',
  });
  const hlLeft = new THREE.Mesh(new THREE.CircleGeometry(isMoving ? 0.2 : 0.13, 12), headlightMat);
  hlLeft.position.set(-0.72, 0.76, TRAIN_LENGTH / 2 + 0.02);
  group.add(hlLeft);

  const hlRight = new THREE.Mesh(new THREE.CircleGeometry(isMoving ? 0.2 : 0.13, 12), headlightMat);
  hlRight.position.set(0.72, 0.76, TRAIN_LENGTH / 2 + 0.02);
  group.add(hlRight);

  if (isMoving) {
    // Hazard bumper stripe on moving express trains so players spot oncoming trains immediately!
    const bumper = new THREE.Mesh(
      new THREE.BoxGeometry(TRAIN_WIDTH + 0.06, 0.32, 0.12),
      new THREE.MeshStandardMaterial({ map: getHazardStripeTexture(), roughness: 0.4 })
    );
    bumper.position.set(0, 0.36, TRAIN_LENGTH / 2 + 0.05);
    group.add(bumper);
  }

  // Rooftop AC vents (low profile so running across roofs looks authentic)
  for (const zOff of [-3.8, 0, 3.8]) {
    const vent = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.1, 1.6),
      new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.5 })
    );
    vent.position.set(0, TRAIN_HEIGHT + 0.04, zOff);
    group.add(vent);
  }

  // Optional Boarding Ramp extending forward (+Z) from the front of the train down to Y=0!
  if (hasRamp) {
    const rampGroup = new THREE.Group();
    const hyp = Math.hypot(RAMP_LENGTH, TRAIN_HEIGHT);
    const angle = Math.atan2(TRAIN_HEIGHT, RAMP_LENGTH);

    const rampSlope = new THREE.Mesh(
      new THREE.BoxGeometry(TRAIN_WIDTH - 0.08, 0.18, hyp),
      new THREE.MeshStandardMaterial({ map: getRampChevronTexture(), roughness: 0.45 })
    );
    rampSlope.position.set(0, TRAIN_HEIGHT / 2 - 0.06, TRAIN_LENGTH / 2 + RAMP_LENGTH / 2);
    // At z = TRAIN_LENGTH/2 (train front), height = TRAIN_HEIGHT; at z = TRAIN_LENGTH/2 + RAMP_LENGTH, height = 0
    rampSlope.rotation.x = angle;
    rampSlope.castShadow = true;
    rampGroup.add(rampSlope);

    // Ramp support struts
    const strutMat = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.4 });
    const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.14, TRAIN_HEIGHT * 0.55, 0.18), strutMat);
    strutL.position.set(-TRAIN_WIDTH / 2 + 0.15, TRAIN_HEIGHT * 0.27, TRAIN_LENGTH / 2 + RAMP_LENGTH * 0.42);
    rampGroup.add(strutL);

    const strutR = strutL.clone();
    strutR.position.x = TRAIN_WIDTH / 2 - 0.15;
    rampGroup.add(strutR);

    group.add(rampGroup);
  }

  return group;
}

export type BarrierKind = 'low' | 'high' | 'full';

export function createBarrierMesh(kind: BarrierKind): THREE.Group {
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.5, roughness: 0.4 });
  const stripeMat = new THREE.MeshStandardMaterial({ map: getHazardStripeTexture(), roughness: 0.35 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: '#f59e0b' });

  if (kind === 'low') {
    // Jumpable low barrier (height ~1.12)
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.12, 0.18), postMat);
    postL.position.set(-0.98, 0.56, 0);
    group.add(postL);

    const postR = postL.clone();
    postR.position.x = 0.98;
    group.add(postR);

    const board = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.54, 0.22), stripeMat);
    board.position.set(0, 0.78, 0);
    board.castShadow = true;
    group.add(board);

    // Amber top warning lights
    const lightL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), beaconMat);
    lightL.position.set(-0.92, 1.14, 0);
    group.add(lightL);
    const lightR = lightL.clone();
    lightR.position.x = 0.92;
    group.add(lightR);
  } else if (kind === 'high') {
    // Roll-under barrier! Open clearance below Y = 1.32, top hazard panel from Y = 1.32 to Y = 2.58
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 0.2), postMat);
    postL.position.set(-1.02, 1.3, 0);
    group.add(postL);

    const postR = postL.clone();
    postR.position.x = 1.02;
    group.add(postR);

    const topBoard = new THREE.Mesh(new THREE.BoxGeometry(2.24, 1.18, 0.24), stripeMat);
    topBoard.position.set(0, 1.95, 0);
    topBoard.castShadow = true;
    group.add(topBoard);

    // Cyan glowing bottom strip signaling "SLIDE UNDER!"
    const slideBar = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.08, 0.26),
      new THREE.MeshBasicMaterial({ color: '#38bdf8' })
    );
    slideBar.position.set(0, 1.34, 0);
    group.add(slideBar);
  } else {
    // Full double-height solid barrier (must switch lanes or fly/super-jump over!)
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.45, 0.24), postMat);
    postL.position.set(-1.02, 1.22, 0);
    group.add(postL);

    const postR = postL.clone();
    postR.position.x = 1.02;
    group.add(postR);

    const board1 = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.92, 0.26), stripeMat);
    board1.position.set(0, 0.65, 0);
    board1.castShadow = true;
    group.add(board1);

    const board2 = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.92, 0.26), stripeMat);
    board2.position.set(0, 1.78, 0);
    board2.castShadow = true;
    group.add(board2);
  }

  return group;
}

// Shared Coin Geometry & Materials for blazing fast rendering of 100+ coins
const sharedCoinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.13, 16);
sharedCoinGeo.rotateX(Math.PI / 2);
const sharedCoinCoreGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.16, 6);
sharedCoinCoreGeo.rotateX(Math.PI / 2);

const sharedCoinMat = new THREE.MeshStandardMaterial({
  color: '#facc15',
  emissive: '#ca8a04',
  emissiveIntensity: 0.35,
  metalness: 0.65,
  roughness: 0.2,
});
const sharedCoinCoreMat = new THREE.MeshStandardMaterial({
  color: '#fef08a',
  emissive: '#eab308',
  emissiveIntensity: 0.5,
  metalness: 0.5,
  roughness: 0.2,
});

export function createCoinMesh(): THREE.Group {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(sharedCoinGeo, sharedCoinMat);
  const core = new THREE.Mesh(sharedCoinCoreGeo, sharedCoinCoreMat);
  g.add(disc);
  g.add(core);
  return g;
}

export function createPowerupMesh(type: PowerUpType): THREE.Group {
  const group = new THREE.Group();

  const haloColors: Record<PowerUpType, string> = {
    jetpack: '#06b6d4',
    magnet: '#ef4444',
    sneakers: '#84cc16',
    multiplier: '#a855f7',
    hoverboard_pickup: '#ec4899',
  };

  // Glowing outer ring
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.68, 0.06, 10, 24),
    new THREE.MeshBasicMaterial({ color: haloColors[type] })
  );
  group.add(halo);

  if (type === 'jetpack') {
    const t1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.65, 10),
      new THREE.MeshStandardMaterial({ color: '#06b6d4', emissive: '#0891b2', emissiveIntensity: 0.4 })
    );
    t1.position.x = -0.16;
    group.add(t1);
    const t2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.65, 10),
      new THREE.MeshStandardMaterial({ color: '#f97316', emissive: '#ea580c', emissiveIntensity: 0.4 })
    );
    t2.position.x = 0.16;
    group.add(t2);
  } else if (type === 'magnet') {
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.11, 10, 18, Math.PI),
      new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#b91c1c', emissiveIntensity: 0.4 })
    );
    arch.position.y = 0.05;
    group.add(arch);
    const tipMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.7, roughness: 0.2 });
    const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), tipMat);
    tipL.position.set(-0.32, -0.1, 0);
    group.add(tipL);
    const tipR = tipL.clone();
    tipR.position.x = 0.32;
    group.add(tipR);
  } else if (type === 'sneakers') {
    const shoeMat = new THREE.MeshStandardMaterial({
      color: '#84cc16',
      emissive: '#4d7c0f',
      emissiveIntensity: 0.5,
    });
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.68), shoeMat);
    sole.position.y = -0.12;
    group.add(sole);
    const ankle = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), shoeMat);
    ankle.position.set(0, 0.12, 0.12);
    group.add(ankle);
  } else if (type === 'multiplier') {
    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.44, 0),
      new THREE.MeshStandardMaterial({
        color: '#facc15',
        emissive: '#a855f7',
        emissiveIntensity: 0.6,
        metalness: 0.4,
        roughness: 0.2,
      })
    );
    group.add(star);
  } else {
    // hoverboard_pickup
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.1, 0.92),
      new THREE.MeshStandardMaterial({
        color: '#ec4899',
        emissive: '#db2777',
        emissiveIntensity: 0.5,
      })
    );
    deck.rotation.z = 0.35;
    deck.rotation.x = 0.35;
    group.add(deck);
  }

  return group;
}
