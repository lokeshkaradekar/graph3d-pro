/**
 * Graph3D Pro — mod-presets.js
 * Module 07 — Built-in Preset Gallery + User Saved Presets
 * ~/graph3d-pro/modules/mod-presets.js
 */

const ModPresets = (() => {

  // ══════════════════════════════════════════════════════
  // BUILT-IN PRESET DATA
  // ══════════════════════════════════════════════════════

  const BUILTIN = [

    // ── EXPLICIT ────────────────────────────────────────
    {
      id:       'ripple',
      name:     'Ripple Wave',
      expr:     'sin(sqrt(x^2+y^2))',
      type:     'explicit',
      color:    '#3b82f6',
      category: 'Explicit',
      tags:     ['wave','sin','classic'],
      desc:     'Classic radial sine wave emanating from the origin',
    },
    {
      id:       'saddle',
      name:     'Saddle Surface',
      expr:     'x^2 - y^2',
      type:     'explicit',
      color:    '#8b5cf6',
      category: 'Explicit',
      tags:     ['saddle','quadratic'],
      desc:     'Hyperbolic paraboloid — a classic saddle shape',
    },
    {
      id:       'gaussian',
      name:     'Gaussian Bell',
      expr:     '3*exp(-(x^2+y^2)/3)',
      type:     'explicit',
      color:    '#10b981',
      category: 'Explicit',
      tags:     ['bell','gaussian','smooth'],
      desc:     'Normal distribution bell curve in 3D',
    },
    {
      id:       'twin-peaks',
      name:     'Twin Peaks',
      expr:     'sin(x^2)*cos(y^2)',
      type:     'explicit',
      color:    '#f59e0b',
      category: 'Explicit',
      tags:     ['sin','cos','complex'],
      desc:     'Oscillating surface with twin peak patterns',
    },
    {
      id:       'monkey-saddle',
      name:     'Monkey Saddle',
      expr:     'x^3 - 3*x*y^2',
      type:     'explicit',
      color:    '#f43f5e',
      category: 'Explicit',
      tags:     ['saddle','cubic','polynomial'],
      desc:     'Has three upward and three downward slopes',
    },
    {
      id:       'wave-envelope',
      name:     'Wave Envelope',
      expr:     'cos(sqrt(x^2+y^2))*exp(-0.1*(x^2+y^2))',
      type:     'explicit',
      color:    '#06b6d4',
      category: 'Explicit',
      tags:     ['wave','envelope','decay'],
      desc:     'Damped radial wave — amplitude decays from center',
    },
    {
      id:       'sombrero',
      name:     'Sombrero',
      expr:     'sin(3.14159*sqrt(x^2+y^2+0.001))/(3.14159*sqrt(x^2+y^2+0.001))',
      type:     'explicit',
      color:    '#f97316',
      category: 'Explicit',
      tags:     ['sinc','sombrero','wave'],
      desc:     'Sinc function in 2D — resembles a Mexican hat',
    },
    {
      id:       'egg-crate',
      name:     'Egg Crate',
      expr:     'sin(x)*sin(y)',
      type:     'explicit',
      color:    '#a3e635',
      category: 'Explicit',
      tags:     ['periodic','sin','grid'],
      desc:     'Periodic surface like an egg crate tray',
    },
    {
      id:       'peaks',
      name:     'MATLAB Peaks',
      expr:     '3*(1-x)^2*exp(-(x^2)-(y+1)^2)-10*(x/5-x^3-y^5)*exp(-x^2-y^2)-1/3*exp(-(x+1)^2-y^2)',
      type:     'explicit',
      color:    '#ec4899',
      category: 'Explicit',
      tags:     ['peaks','complex','classic'],
      desc:     'Classic MATLAB peaks function',
    },
    {
      id:       'paraboloid',
      name:     'Paraboloid',
      expr:     'x^2 + y^2',
      type:     'explicit',
      color:    '#3b82f6',
      category: 'Explicit',
      tags:     ['paraboloid','bowl','quadratic'],
      desc:     'Circular paraboloid — bowl shape opening upward',
    },
    {
      id:       'hyperbolic',
      name:     'Hyperbolic Paraboloid',
      expr:     '(x^2/4) - (y^2/9)',
      type:     'explicit',
      color:    '#8b5cf6',
      category: 'Explicit',
      tags:     ['hyperbolic','saddle','quadratic'],
      desc:     'Asymmetric saddle — different curvatures per axis',
    },
    {
      id:       'ripple-animated',
      name:     'Animated Ripple',
      expr:     'sin(sqrt(x^2+y^2) - t)',
      type:     'explicit',
      color:    '#06b6d4',
      category: 'Explicit',
      tags:     ['animated','wave','t'],
      desc:     'Propagating ripple — use Animate for motion',
      needsT:   true,
    },
    {
      id:       'cross-wave',
      name:     'Cross Wave',
      expr:     'sin(x*a)*cos(y*b)',
      type:     'explicit',
      color:    '#f59e0b',
      category: 'Explicit',
      tags:     ['wave','sliders','a','b'],
      desc:     'Frequency-controlled cross wave — add sliders a, b',
      needsSliders: ['a','b'],
    },
    {
      id:       'spiral-ramp',
      name:     'Spiral Ramp',
      expr:     'atan2(y,x)/(2*3.14159)*2',
      type:     'explicit',
      color:    '#a3e635',
      category: 'Explicit',
      tags:     ['spiral','atan','ramp'],
      desc:     'Helical ramp surface using atan2',
    },

    // ── PARAMETRIC ───────────────────────────────────────
    {
      id:       'sphere',
      name:     'Sphere',
      expr:     'cos(u)*sin(v), sin(u)*sin(v), cos(v)',
      type:     'parametric',
      color:    '#3b82f6',
      category: 'Parametric',
      tags:     ['sphere','classic','closed'],
      desc:     'Unit sphere via spherical parametrization',
    },
    {
      id:       'torus',
      name:     'Torus',
      expr:     '(2+cos(v))*cos(u), (2+cos(v))*sin(u), sin(v)',
      type:     'parametric',
      color:    '#8b5cf6',
      category: 'Parametric',
      tags:     ['torus','donut','closed'],
      desc:     'Standard torus with major radius 2, minor radius 1',
    },
    {
      id:       'cone',
      name:     'Cone',
      expr:     'u*cos(v), u*sin(v), u',
      type:     'parametric',
      color:    '#10b981',
      category: 'Parametric',
      tags:     ['cone','linear'],
      desc:     'Right circular cone opening upward',
    },
    {
      id:       'cylinder',
      name:     'Cylinder',
      expr:     'cos(u), sin(u), v',
      type:     'parametric',
      color:    '#06b6d4',
      category: 'Parametric',
      tags:     ['cylinder','tube'],
      desc:     'Unit cylinder along the Z axis',
    },
    {
      id:       'mobius',
      name:     'Mobius Strip',
      expr:     '(1+0.5*v*cos(u/2))*cos(u), (1+0.5*v*cos(u/2))*sin(u), 0.5*v*sin(u/2)',
      type:     'parametric',
      color:    '#f59e0b',
      category: 'Parametric',
      tags:     ['mobius','topology','one-sided'],
      desc:     'One-sided non-orientable surface',
    },
    {
      id:       'klein',
      name:     'Klein Bottle',
      expr:     '(2+cos(v/2)*sin(u)-sin(v/2)*sin(2*u))*cos(v), (2+cos(v/2)*sin(u)-sin(v/2)*sin(2*u))*sin(v), sin(v/2)*sin(u)+cos(v/2)*sin(2*u)',
      type:     'parametric',
      color:    '#f43f5e',
      category: 'Parametric',
      tags:     ['klein','topology','non-orientable'],
      desc:     'Non-orientable closed surface with no boundary',
    },
    {
      id:       'seashell',
      name:     'Seashell',
      expr:     '(1-v/(2*3.14159))*(1+cos(u))*cos(2*v), (1-v/(2*3.14159))*(1+cos(u))*sin(2*v), v/(2*3.14159)+sin(u)*(1-v/(2*3.14159))',
      type:     'parametric',
      color:    '#06b6d4',
      category: 'Parametric',
      tags:     ['seashell','natural','spiral'],
      desc:     'Nautilus seashell parametrization',
    },
    {
      id:       'boy-surface',
      name:     'Boy Surface',
      expr:     '(sqrt(2)*cos(v)^2*cos(2*u)+cos(u)*sin(2*v))/(2-sqrt(2)*sin(3*u)*sin(2*v)), (sqrt(2)*cos(v)^2*sin(2*u)-sin(u)*sin(2*v))/(2-sqrt(2)*sin(3*u)*sin(2*v)), (3*cos(v)^2)/(2-sqrt(2)*sin(3*u)*sin(2*v))',
      type:     'parametric',
      color:    '#ec4899',
      category: 'Parametric',
      tags:     ['boy','topology','projective'],
      desc:     'Immersion of the real projective plane',
    },
    {
      id:       'enneper',
      name:     'Enneper Surface',
      expr:     'u - u^3/3 + u*v^2, v - v^3/3 + v*u^2, u^2 - v^2',
      type:     'parametric',
      color:    '#f97316',
      category: 'Parametric',
      tags:     ['enneper','minimal','surface'],
      desc:     'Classic minimal surface with self-intersections',
    },
    {
      id:       'dini',
      name:     "Dini's Surface",
      expr:     'cos(u)*sin(v), sin(u)*sin(v), cos(v)+log(tan(v/2))+0.2*u',
      type:     'parametric',
      color:    '#a3e635',
      category: 'Parametric',
      tags:     ['dini','pseudosphere','constant'],
      desc:     'Constant negative Gaussian curvature surface',
    },
    {
      id:       'steiner',
      name:     'Steiner Surface',
      expr:     'sin(2*u)*cos(v)^2, sin(u)*sin(2*v), cos(u)*sin(2*v)',
      type:     'parametric',
      color:    '#8b5cf6',
      category: 'Parametric',
      tags:     ['steiner','roman','quartic'],
      desc:     'Steiner Roman surface — a quartic surface',
    },
    {
      id:       'twisted-torus',
      name:     'Twisted Torus',
      expr:     '(2+cos(v))*cos(u+t), (2+cos(v))*sin(u+t), sin(v)',
      type:     'parametric',
      color:    '#f43f5e',
      category: 'Parametric',
      tags:     ['torus','animated','twisted','t'],
      desc:     'Rotating torus — animate with t slider',
      needsT:   true,
    },

    // ── IMPLICIT ─────────────────────────────────────────
    {
      id:       'sphere-impl',
      name:     'Sphere (Implicit)',
      expr:     'x^2+y^2+z^2-4',
      type:     'implicit',
      color:    '#06b6d4',
      category: 'Implicit',
      tags:     ['sphere','classic'],
      desc:     'Unit sphere of radius 2 as implicit surface',
    },
    {
      id:       'torus-impl',
      name:     'Torus (Implicit)',
      expr:     '(sqrt(x^2+y^2)-2)^2+z^2-1',
      type:     'implicit',
      color:    '#f43f5e',
      category: 'Implicit',
      tags:     ['torus','donut'],
      desc:     'Torus defined implicitly',
    },
    {
      id:       'gyroid',
      name:     'Gyroid',
      expr:     'sin(x)*cos(y)+sin(y)*cos(z)+sin(z)*cos(x)',
      type:     'implicit',
      color:    '#8b5cf6',
      category: 'Implicit',
      tags:     ['gyroid','triply-periodic','minimal'],
      desc:     'Triply periodic minimal surface found in nature',
    },
    {
      id:       'schwarz-p',
      name:     'Schwarz P Surface',
      expr:     'cos(x)+cos(y)+cos(z)',
      type:     'implicit',
      color:    '#10b981',
      category: 'Implicit',
      tags:     ['schwarz','minimal','periodic'],
      desc:     'Triply periodic minimal surface by Schwarz',
    },
    {
      id:       'double-horn',
      name:     'Double Horn',
      expr:     'x^2+y^2-z^2*(1-z^2)',
      type:     'implicit',
      color:    '#f59e0b',
      category: 'Implicit',
      tags:     ['horn','algebraic'],
      desc:     'Algebraic surface with two horn-like protrusions',
    },
    {
      id:       'cayley',
      name:     'Cayley Cubic',
      expr:     'x^2+y^2+z^2-x*y-y*z-x*z-1',
      type:     'implicit',
      color:    '#f97316',
      category: 'Implicit',
      tags:     ['cayley','cubic','algebraic'],
      desc:     'Cayley nodal cubic surface',
    },
    {
      id:       'heart',
      name:     'Heart Surface',
      expr:     '(x^2+9/4*y^2+z^2-1)^3-x^2*z^3-9/200*y^2*z^3',
      type:     'implicit',
      color:    '#f43f5e',
      category: 'Implicit',
      tags:     ['heart','romantic','fun'],
      desc:     'Heart-shaped algebraic surface',
    },

    // ── SPACE CURVES ─────────────────────────────────────
    {
      id:       'helix',
      name:     'Helix',
      expr:     'cos(t), sin(t), t/3',
      type:     'curve',
      color:    '#f97316',
      category: 'Curves',
      tags:     ['helix','spiral','3d'],
      desc:     'Standard helix spiraling up the Z axis',
    },
    {
      id:       'trefoil',
      name:     'Trefoil Knot',
      expr:     'sin(t)+2*sin(2*t), cos(t)-2*cos(2*t), -sin(3*t)',
      type:     'curve',
      color:    '#ec4899',
      category: 'Curves',
      tags:     ['knot','trefoil','topology'],
      desc:     'Simplest non-trivial knot in 3D space',
    },
    {
      id:       'torus-knot',
      name:     'Torus Knot (3,5)',
      expr:     '(2+cos(5*t))*cos(3*t), (2+cos(5*t))*sin(3*t), sin(5*t)',
      type:     'curve',
      color:    '#8b5cf6',
      category: 'Curves',
      tags:     ['knot','torus','topology'],
      desc:     '(3,5) torus knot — wraps around a torus',
    },
    {
      id:       'lissajous',
      name:     'Lissajous 3D',
      expr:     'sin(3*t), sin(2*t), sin(t)',
      type:     'curve',
      color:    '#06b6d4',
      category: 'Curves',
      tags:     ['lissajous','harmonic','3d'],
      desc:     '3D Lissajous figure from harmonic oscillations',
    },
    {
      id:       'viviani',
      name:     "Viviani's Curve",
      expr:     '1+cos(t), sin(t), 2*sin(t/2)',
      type:     'curve',
      color:    '#a3e635',
      category: 'Curves',
      tags:     ['viviani','sphere','cylinder'],
      desc:     'Intersection of a sphere and a cylinder',
    },
    {
      id:       'figure-eight',
      name:     'Figure-Eight Knot',
      expr:     '(2+cos(2*t))*cos(3*t), (2+cos(2*t))*sin(3*t), sin(4*t)',
      type:     'curve',
      color:    '#f43f5e',
      category: 'Curves',
      tags:     ['knot','figure-eight','topology'],
      desc:     'Figure-eight knot — second simplest knot',
    },

    // ── POLAR ────────────────────────────────────────────
    {
      id:       'polar-rose',
      name:     'Rose (Polar)',
      expr:     'cos(3*r)',
      type:     'polar',
      color:    '#a3e635',
      category: 'Polar',
      tags:     ['rose','polar','petal'],
      desc:     '3-petal rose in polar coordinates',
    },
    {
      id:       'polar-ripple',
      name:     'Polar Ripple',
      expr:     'sin(2*r)',
      type:     'polar',
      color:    '#3b82f6',
      category: 'Polar',
      tags:     ['ripple','polar','wave'],
      desc:     'Radial wave in polar coordinates',
    },
    {
      id:       'polar-dome',
      name:     'Polar Dome',
      expr:     'cos(r)',
      type:     'polar',
      color:    '#06b6d4',
      category: 'Polar',
      tags:     ['dome','polar','smooth'],
      desc:     'Smooth dome from polar cosine',
    },
    {
      id:       'polar-funnel',
      name:     'Polar Funnel',
      expr:     '1/r',
      type:     'polar',
      color:    '#f59e0b',
      category: 'Polar',
      tags:     ['funnel','polar','hyperbola'],
      desc:     'Funnel surface — diverges at origin',
    },

    // ── POLAR CURVES (2D) — r = f(theta), flat in the ground plane.
    // Distinct from the 3D "Polar" surfaces above (those are
    // z=f(r,theta) height fields; these trace a genuine 2D polar curve
    // like a rose or cardioid, the classic r=f(theta) shape). ────────
    {
      id:       'polar-curve-rose',
      name:     'Rose Curve (2D)',
      expr:     'r = sin(4*theta)',
      type:     'polarCurve',
      color:    '#ec4899',
      category: 'Polar Curves',
      tags:     ['rose','polar','petal','2d'],
      desc:     '8-petal rose — r=sin(n*theta) makes 2n petals for even n, n petals for odd n',
      tMin: 0, tMax: 6.2832, // one full revolution (2*pi) traces every petal
    },
    {
      id:       'polar-curve-cardioid',
      name:     'Cardioid',
      expr:     'r = 1 + cos(theta)',
      type:     'polarCurve',
      color:    '#f97316',
      category: 'Polar Curves',
      tags:     ['cardioid','polar','2d'],
      desc:     'Heart-shaped curve — a circle rolling around a circle of the same size',
      tMin: 0, tMax: 6.2832,
    },
    {
      id:       'polar-curve-limacon',
      name:     'Limaçon (inner loop)',
      expr:     'r = 1 + 2*cos(theta)',
      type:     'polarCurve',
      color:    '#8b5cf6',
      category: 'Polar Curves',
      tags:     ['limacon','polar','2d','negative-radius'],
      desc:     'The inner loop exists ONLY because r goes negative for part of theta — a direct showcase of correct negative-radius handling (no Math.abs() folding)',
      tMin: 0, tMax: 6.2832,
    },
    {
      id:       'polar-curve-spiral',
      name:     'Archimedean Spiral',
      expr:     'r = theta',
      type:     'polarCurve',
      color:    '#22d3ee',
      category: 'Polar Curves',
      tags:     ['spiral','polar','2d'],
      desc:     'r = theta — radius grows linearly with angle, tracing several full turns',
      tMin: 0, tMax: 18.85, // 3 full revolutions (3*2*pi)
    },

    // ── VECTOR FIELDS ────────────────────────────────────
    {
      id:       'vf-rotation',
      name:     'Rotation Field',
      expr:     '-y, x, 0',
      type:     'vector',
      color:    '#3b82f6',
      category: 'Vector',
      tags:     ['rotation','curl','vortex'],
      desc:     'Uniform rotation field around Z axis',
    },
    {
      id:       'vf-source',
      name:     'Source Field',
      expr:     'x, y, z',
      type:     'vector',
      color:    '#10b981',
      category: 'Vector',
      tags:     ['source','divergence','radial'],
      desc:     'Radially outward field from origin',
    },
    {
      id:       'vf-sink',
      name:     'Sink Field',
      expr:     '-x, -y, -z',
      type:     'vector',
      color:    '#f43f5e',
      category: 'Vector',
      tags:     ['sink','divergence','radial'],
      desc:     'Radially inward field toward origin',
    },
    {
      id:       'vf-saddle',
      name:     'Saddle Field',
      expr:     'x, -y, 0',
      type:     'vector',
      color:    '#8b5cf6',
      category: 'Vector',
      tags:     ['saddle','hyperbolic'],
      desc:     'Hyperbolic vector field — saddle pattern',
    },
    {
      id:       'vf-curl',
      name:     'Curl Field',
      expr:     'y*z, -x*z, x*y',
      type:     'vector',
      color:    '#f97316',
      category: 'Vector',
      tags:     ['curl','magnetic','complex'],
      desc:     'Field with non-zero curl — magnetic-like',
    },

    // ── PHYSICS ──────────────────────────────────────────
    {
      id:       'physics-projectile',
      name:     'Projectile Motion',
      expr:     'v0*cos(theta)*t, w*t, v0*sin(theta)*t - 0.5*g*t^2',
      type:     'curve',
      color:    '#ef4444',
      category: 'Physics',
      tags:     ['projectile','kinematics','trajectory','gravity'],
      desc:     'Launch trajectory under gravity; w adds sideways wind drift',
      tMin: 0, tMax: 3,
      needsSliders: [
        { name: 'v0',    value: 12,   min: 1,   max: 30, step: 0.5 },
        { name: 'theta', value: 0.79, min: 0,   max: 1.5708, step: 0.01 }, // ~pi/4 rad
        { name: 'g',     value: 9.8,  min: 1,   max: 20,  step: 0.1 },
        { name: 'w',     value: 0,    min: -5,  max: 5,   step: 0.25 },
      ],
    },
    {
      id:       'physics-wave',
      name:     'Traveling Wave',
      expr:     'A*sin(k*x - omega*t)',
      type:     'explicit',
      color:    '#3b82f6',
      category: 'Physics',
      tags:     ['wave','oscillation','wave-equation'],
      desc:     'Solution to the 1D wave equation; flip the sign of omega to reverse direction',
      needsT: true,
      needsSliders: [
        { name: 'A',     value: 1.5, min: 0,    max: 3,  step: 0.1 },
        { name: 'k',     value: 1.5, min: 0.2,  max: 5,  step: 0.1 },
        { name: 'omega', value: 2,   min: -6,   max: 6,  step: 0.1 },
      ],
    },
    {
      id:       'physics-heat',
      name:     'Heat Diffusion',
      expr:     '(1/(4*pi*D*el))*exp(-(x^2+y^2)/(4*D*el))',
      type:     'explicit',
      color:    '#f59e0b',
      category: 'Physics',
      tags:     ['heat','diffusion','heat-equation','gaussian'],
      desc:     'Heat kernel: temperature spreading from a point source since time el (elapsed)',
      needsSliders: [
        { name: 'D',  value: 1, min: 0.1, max: 3, step: 0.05 },
        { name: 'el', value: 1, min: 0.1, max: 5, step: 0.05 }, // must stay > 0 — this is elapsed time. NOT named "tau": that's a reserved built-in constant (tau=2*pi) and can never be a valid slider name.
      ],
    },
    {
      id:       'physics-efield',
      name:     'Electric Field (Point Charge)',
      expr:     'k*q*x/(x^2+y^2+z^2+0.05)^1.5, k*q*y/(x^2+y^2+z^2+0.05)^1.5, k*q*z/(x^2+y^2+z^2+0.05)^1.5',
      type:     'vector',
      color:    '#a855f7',
      category: 'Physics',
      tags:     ['electric-field','coulomb','em','charge'],
      desc:     "Coulomb's law field around a point charge — k is a visualization-scale constant, not the true SI value; flip q's sign for attractive vs. repulsive",
      needsSliders: [
        { name: 'k', value: 5, min: 0.5, max: 15, step: 0.5 },
        { name: 'q', value: 1, min: -3,  max: 3,  step: 0.25 },
      ],
    },
    {
      id:       'physics-orbit',
      name:     'Kepler Orbit',
      expr:     '(a*(1-ecc^2)/(1+ecc*cos(t)))*cos(t), (a*(1-ecc^2)/(1+ecc*cos(t)))*sin(t)*cos(inc), (a*(1-ecc^2)/(1+ecc*cos(t)))*sin(t)*sin(inc)',
      type:     'curve',
      color:    '#22d3ee',
      category: 'Physics',
      tags:     ['orbit','kepler','astronomy','ellipse'],
      desc:     "Keplerian orbit — a=semi-major axis, ecc=eccentricity, inc=inclination (t plays the role of true anomaly). NOT named \"e\": that's the reserved built-in constant (Euler's number) and can never be a valid slider name.",
      tMin: 0, tMax: 6.2832, // one full revolution (2*pi) — a closed ellipse shouldn't overlap itself
      needsSliders: [
        { name: 'a',   value: 3,    min: 0.5, max: 6,   step: 0.1 },
        { name: 'ecc', value: 0.5,  min: 0,   max: 0.9, step: 0.01 },
        { name: 'inc', value: 0.52, min: 0,   max: 1.5708, step: 0.01 }, // ~pi/6 rad
      ],
    },
  ];

  // ══════════════════════════════════════════════════════
  // CATEGORIES (display order)
  // ══════════════════════════════════════════════════════

  const CATEGORIES = [
    'Explicit',
    'Parametric',
    'Implicit',
    'Curves',
    'Polar',
    'Vector',
    'Physics',
    'Saved',
  ];

  const CATEGORY_COLORS = {
    Featured:   'var(--gold, #eab308)',
    Explicit:   'var(--accent)',
    Parametric: 'var(--violet)',
    Implicit:   'var(--green)',
    Curves:     'var(--cyan)',
    Polar:      'var(--orange)',
    Vector:     'var(--pink)',
    Physics:    'var(--red, #ef4444)',
    Saved:      'var(--amber)',
  };

  // A hand-picked, visually varied pool spanning every category. Which N
  // are shown rotates daily so "Featured" isn't the exact same 8 forever —
  // no backend needed, just a date-seeded offset into a fixed list.
  const FEATURED_POOL = [
    'ripple', 'sombrero', 'monkey-saddle', 'sphere', 'torus', 'mobius',
    'seashell', 'trefoil', 'torus-knot', 'gyroid', 'heart', 'polar-rose',
    'vf-rotation', 'klein',
  ];
  const FEATURED_COUNT = 8;
  const FIRST_VISIT_KEY = 'g3d_presets_visited';

  function _getFeaturedIds() {
    const dayIndex = Math.floor(Date.now() / 86400000); // new rotation once/day
    const start = dayIndex % FEATURED_POOL.length;
    const picked = [];
    for (let i = 0; i < FEATURED_COUNT && i < FEATURED_POOL.length; i++) {
      picked.push(FEATURED_POOL[(start + i) % FEATURED_POOL.length]);
    }
    return picked;
  }

  function _isFirstVisit() {
    try {
      if (localStorage.getItem(FIRST_VISIT_KEY)) return false;
      localStorage.setItem(FIRST_VISIT_KEY, '1');
      return true;
    } catch {
      return false; // if storage is unavailable, don't force Featured on every load
    }
  }

  // ── User saved presets (localStorage) ─────────────────
  let _userPresets = [];

  // ── Active filter ──────────────────────────────────────
  // Starts on 'Featured' for a brand-new visitor (fewer, curated cards
  // instead of 49 at once); returning visitors keep seeing 'All' as before.
  let _activeCategory = 'All';
  let _searchQuery    = '';

  // ══════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════

  function init() {
    _loadUserPresets();
    if (_isFirstVisit()) _activeCategory = 'Featured';
    _buildUI();
  }

  // ══════════════════════════════════════════════════════
  // BUILD UI
  // ══════════════════════════════════════════════════════

  function _buildUI() {
    const container = document.getElementById('sec-pr');
    if (!container) return;

    // ── Search bar ──────────────────────────────────────
    const searchWrap = document.createElement('div');
    searchWrap.style.cssText = 'position:relative;margin-bottom:8px';
    searchWrap.innerHTML = `
      <input id="preset-search" type="text"
        placeholder="Search presets..."
        style="width:100%;background:var(--s2);border:1px solid var(--b2);
               color:var(--t1);font-size:11.5px;padding:5px 8px 5px 28px;
               border-radius:var(--radius);outline:none;font-family:var(--font-ui)"/>
      <i data-lucide="search" width="12" height="12"
         style="position:absolute;left:8px;top:50%;transform:translateY(-50%);
                color:var(--t3);pointer-events:none"></i>
    `;
    container.appendChild(searchWrap);

    const searchInp = searchWrap.querySelector('#preset-search');
    searchInp.addEventListener('input', e => {
      _searchQuery = e.target.value.toLowerCase().trim();
      _renderGrid();
    });
    searchInp.addEventListener('focus', e => {
      e.target.style.borderColor = 'var(--abrd)';
    });
    searchInp.addEventListener('blur', e => {
      e.target.style.borderColor = 'var(--b2)';
    });

    // ── Category filter pills ────────────────────────────
    const pillsWrap = document.createElement('div');
    pillsWrap.id = 'preset-pills';
    pillsWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px';

    const featuredPill = _makePill('Featured', _activeCategory === 'Featured');
    pillsWrap.appendChild(featuredPill);
    const allPill = _makePill('All', _activeCategory === 'All');
    pillsWrap.appendChild(allPill);
    CATEGORIES.forEach(cat => pillsWrap.appendChild(_makePill(cat, _activeCategory === cat)));
    container.appendChild(pillsWrap);

    // ── Preset grid ──────────────────────────────────────
    const grid = document.createElement('div');
    grid.id = 'preset-grid';
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:4px';
    container.appendChild(grid);

    // ── Save current button ──────────────────────────────
    const saveBtn = document.createElement('button');
    saveBtn.id = 'save-preset-btn';
    saveBtn.style.cssText = `
      margin-top:8px;width:100%;background:none;
      border:1px dashed var(--b2);color:var(--t3);
      border-radius:var(--radius);padding:6px;cursor:pointer;
      font-size:11px;font-family:var(--font-ui);font-weight:500;
      display:flex;align-items:center;justify-content:center;gap:5px;
      transition:all .14s
    `;
    saveBtn.innerHTML = '<i data-lucide="bookmark-plus" width="12" height="12"></i> Save current graph';
    saveBtn.addEventListener('mouseenter', () => {
      saveBtn.style.borderColor = 'var(--amber)';
      saveBtn.style.color = 'var(--amber)';
    });
    saveBtn.addEventListener('mouseleave', () => {
      saveBtn.style.borderColor = 'var(--b2)';
      saveBtn.style.color = 'var(--t3)';
    });
    saveBtn.addEventListener('click', saveCurrentAsPreset);
    container.appendChild(saveBtn);

    // ── Import / Export saved presets ─────────────────────
    const ioRow = document.createElement('div');
    ioRow.style.cssText = 'display:flex;gap:4px;margin-top:5px';
    [
      { label: 'Export', icon: 'download', action: exportUserPresets },
      { label: 'Import', icon: 'upload',   action: _triggerImportDialog },
    ].forEach(({ label, icon, action }) => {
      const btn = document.createElement('button');
      btn.style.cssText = `
        flex:1;background:none;border:1px dashed var(--b2);color:var(--t3);
        border-radius:var(--radius);padding:5px;cursor:pointer;
        font-size:10.5px;font-family:var(--font-ui);font-weight:500;
        display:flex;align-items:center;justify-content:center;gap:4px;
        transition:all .14s
      `;
      btn.innerHTML = `<i data-lucide="${icon}" width="11" height="11"></i> ${label}`;
      btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'var(--abrd)'; btn.style.color = 'var(--accent)'; });
      btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'var(--b2)'; btn.style.color = 'var(--t3)'; });
      btn.addEventListener('click', action);
      ioRow.appendChild(btn);
    });
    container.appendChild(ioRow);

    if (window.lucide) lucide.createIcons({ nodes: [container] });
    _renderGrid();
  }

  function _makePill(label, active) {
    const pill = document.createElement('button');
    const color = CATEGORY_COLORS[label] || 'var(--accent)';
    pill.dataset.cat = label;
    pill.style.cssText = `
      background:${active ? 'var(--adim)' : 'var(--s2)'};
      border:1px solid ${active ? 'var(--abrd)' : 'var(--b2)'};
      color:${active ? color : 'var(--t2)'};
      border-radius:20px;padding:2px 8px;cursor:pointer;
      font-size:9.5px;font-weight:600;letter-spacing:.4px;
      text-transform:uppercase;transition:all .14s;white-space:nowrap;
      font-family:var(--font-ui)
    `;
    pill.textContent = label;
    pill.addEventListener('click', () => {
      _activeCategory = label;
      document.querySelectorAll('#preset-pills button').forEach(p => {
        const isActive = p.dataset.cat === label;
        const pColor = CATEGORY_COLORS[p.dataset.cat] || 'var(--accent)';
        p.style.background    = isActive ? 'var(--adim)' : 'var(--s2)';
        p.style.borderColor   = isActive ? 'var(--abrd)' : 'var(--b2)';
        p.style.color         = isActive ? pColor : 'var(--t2)';
      });
      _renderGrid();
    });
    return pill;
  }

  // ══════════════════════════════════════════════════════
  // RENDER GRID
  // ══════════════════════════════════════════════════════

  function _renderGrid() {
    const grid = document.getElementById('preset-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const allPresets = [...BUILTIN, ..._userPresets];

    const filtered = allPresets.filter(p => {
      const catMatch = _activeCategory === 'All'
        || (_activeCategory === 'Featured' && _getFeaturedIds().includes(p.id))
        || p.category === _activeCategory
        || (_activeCategory === 'Saved' && p.userSaved);

      const q = _searchQuery;
      const searchMatch = !q
        || p.name.toLowerCase().includes(q)
        || p.expr.toLowerCase().includes(q)
        || (p.tags || []).some(t => t.includes(q))
        || (p.desc || '').toLowerCase().includes(q)
        || (p.category || '').toLowerCase().includes(q)
        || (p.type || '').toLowerCase().includes(q);

      return catMatch && searchMatch;
    });

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `
        grid-column:1/-1;padding:16px;text-align:center;
        color:var(--t3);font-size:11.5px
      `;
      empty.textContent = 'No presets found';
      grid.appendChild(empty);
      return;
    }

    filtered.forEach(p => {
      const card = _makeCard(p);
      grid.appendChild(card);
    });
  }

  // ══════════════════════════════════════════════════════
  // THUMBNAILS
  //
  // Real (tiny, 80x80) WebGL renders for explicit/parametric presets —
  // cheap to generate and genuinely representative. Implicit/curve/polar/
  // vector types would need marching cubes / line geometry / arrow
  // instancing to render accurately; rather than ship a misleading
  // approximation, those get a deterministic gradient + icon instead.
  //
  // One shared offscreen renderer, reused sequentially and lazily (only
  // when a card actually scrolls into view) — with 49 presets, keeping
  // this to a single WebGL context matters, not just style.
  // ══════════════════════════════════════════════════════

  const THUMB_SIZE = 80;
  let _thumbRenderer = null, _thumbScene = null, _thumbCamera = null;
  const _thumbCache = new Map(); // preset.id -> dataURL (in-memory, this session)

  const TYPE_ICON = {
    implicit: 'box', curve: 'spline', polarCurve: 'spline', polar: 'compass',
    cylindrical: 'compass', spherical: 'compass', vector: 'move-3d',
  };

  function _ensureThumbRenderer() {
    if (_thumbRenderer || !window.THREE) return;
    try {
      const canvas = document.createElement('canvas');
      _thumbRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      _thumbRenderer.setSize(THUMB_SIZE, THUMB_SIZE);
      _thumbScene = new THREE.Scene();
      _thumbCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      _thumbCamera.position.set(2.2, 1.9, 2.2);
      _thumbCamera.lookAt(0, 0, 0);
      _thumbScene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const dl = new THREE.DirectionalLight(0xffffff, 0.55);
      dl.position.set(3, 5, 2);
      _thumbScene.add(dl);
    } catch {
      _thumbRenderer = null; // WebGL context creation can fail (old GPU, too many contexts) — fall back gracefully
    }
  }

  function _normalizeToUnitBox(positions) {
    let maxAbs = 0.001;
    for (let i = 0; i < positions.length; i++) maxAbs = Math.max(maxAbs, Math.abs(positions[i]));
    const scale = 1.5 / maxAbs;
    for (let i = 0; i < positions.length; i++) positions[i] *= scale;
  }

  function _presetSliderDefaults(preset) {
    const defaults = {};
    if (preset.needsT) defaults.t = 0;
    if (preset.needsSliders) {
      preset.needsSliders.forEach(spec => {
        if (typeof spec === 'string') defaults[spec] = 1;
        else defaults[spec.name] = spec.value ?? 1;
      });
    }
    return defaults;
  }

  function _buildThumbGeometry(preset) {
    if (!window.MathEngine) return null;
    const sliders = { ..._presetSliderDefaults(preset), ...(window.ModSliders ? ModSliders.getValues() : {}) };
    const N = 16; // this renders at 80x80 — a coarse grid is indistinguishable at that size and stays fast
    const positions = [], indices = [];

    if (preset.type === 'explicit') {
      const range = 5;
      for (let i = 0; i <= N; i++) {
        for (let j = 0; j <= N; j++) {
          const x = -range + (2 * range) * i / N;
          const y = -range + (2 * range) * j / N;
          let z = 0;
          try { z = MathEngine.evalExpr(preset.expr, { x, y, ...sliders }); } catch {}
          if (!isFinite(z)) z = 0;
          positions.push(x, Math.max(-range, Math.min(range, z)), y);
        }
      }
      _normalizeToUnitBox(positions);
    } else if (preset.type === 'parametric') {
      const parts = preset.expr.split(',');
      if (parts.length < 3) return null;
      const uMax = Math.PI * 2, vMax = Math.PI;
      for (let i = 0; i <= N; i++) {
        for (let j = 0; j <= N; j++) {
          const u = uMax * i / N, v = vMax * j / N;
          const scope = { u, v, t: sliders.t || 0, ...sliders };
          let x = 0, y = 0, z = 0;
          try {
            x = MathEngine.evalExpr(parts[0].trim(), scope);
            y = MathEngine.evalExpr(parts[1].trim(), scope);
            z = MathEngine.evalExpr(parts[2].trim(), scope);
          } catch {}
          positions.push(isFinite(x) ? x : 0, isFinite(y) ? y : 0, isFinite(z) ? z : 0);
        }
      }
      _normalizeToUnitBox(positions);
    } else {
      return null;
    }

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const a = i * (N + 1) + j, b = a + 1, c = a + (N + 1), d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  function _renderThumbnail(preset) {
    _ensureThumbRenderer();
    if (!_thumbRenderer) return null;

    const geo = _buildThumbGeometry(preset);
    if (!geo) return null;

    const mat = new THREE.MeshPhongMaterial({ color: preset.color, side: THREE.DoubleSide, shininess: 35 });
    const mesh = new THREE.Mesh(geo, mat);
    _thumbScene.add(mesh);

    let dataUrl = null;
    try {
      _thumbRenderer.render(_thumbScene, _thumbCamera);
      dataUrl = _thumbRenderer.domElement.toDataURL('image/jpeg', 0.72);
    } catch {
      dataUrl = null;
    }

    _thumbScene.remove(mesh);
    geo.dispose();
    mat.dispose();
    return dataUrl;
  }

  function _getThumbnail(preset) {
    if (_thumbCache.has(preset.id)) return Promise.resolve(_thumbCache.get(preset.id));
    if (preset.type !== 'explicit' && preset.type !== 'parametric') return Promise.resolve(null);

    return new Promise(resolve => {
      const run = () => {
        const url = _renderThumbnail(preset);
        _thumbCache.set(preset.id, url);
        resolve(url);
      };
      // Defer to idle time so scrolling through the gallery never jank on
      // a burst of cards becoming visible at once.
      if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 600 });
      else setTimeout(run, 0);
    });
  }

  // One shared observer for every card's thumbnail slot
  let _thumbObserver = null;
  function _observeThumb(el, preset) {
    if (preset.type === 'explicit' || preset.type === 'parametric') {
      if (!_thumbObserver) {
        _thumbObserver = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const target = entry.target;
            _thumbObserver.unobserve(target);
            _getThumbnail(target._preset).then(url => {
              if (url) target.style.backgroundImage = `url(${url})`;
              target.classList.remove('thumb-loading');
            });
          });
        }, { rootMargin: '80px' });
      }
      el._preset = preset;
      el.classList.add('thumb-loading');
      _thumbObserver.observe(el);
    } else {
      // No live render for this type — deterministic icon + gradient, no observer needed
      el.style.background = `linear-gradient(135deg, ${preset.color}33, ${preset.color}0d)`;
      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', TYPE_ICON[preset.type] || 'shapes');
      icon.setAttribute('width', '20');
      icon.setAttribute('height', '20');
      icon.style.cssText = `position:absolute;inset:0;margin:auto;width:20px;height:20px;color:${preset.color}`;
      el.appendChild(icon);
      if (window.lucide) lucide.createIcons({ nodes: [el] });
    }
  }

  // ══════════════════════════════════════════════════════
  // MAKE PRESET CARD
  // ══════════════════════════════════════════════════════

  function _makeCard(preset) {
    const card = document.createElement('div');
    card.className = 'preset-card';
    card.title = preset.desc || preset.expr;

    const typeClass = {
      explicit:    'pt-explicit',
      parametric:  'pt-parametric',
      implicit:    'pt-implicit',
      curve:       'pt-curve',
      polarCurve:  'pt-curve',
      polar:       'pt-polar',
      cylindrical: 'pt-polar',
      spherical:   'pt-polar',
      vector:      'pt-vector',
    }[preset.type] || 'pt-explicit';

    const typeLabel = {
      explicit:    'Explicit',
      parametric:  'Param',
      implicit:    'Implicit',
      curve:       'Curve',
      polarCurve:  'Polar (2D)',
      polar:       'Polar',
      cylindrical: 'Cylindrical',
      spherical:   'Spherical',
      vector:      'Vector',
    }[preset.type] || 'Explicit';

    const exprShort = preset.expr.length > 26
      ? preset.expr.slice(0, 26) + '...'
      : preset.expr;

    card.innerHTML = `
      <div class="preset-thumb" style="position:relative;width:100%;height:40px;
                  border-radius:5px;margin-bottom:5px;overflow:hidden;
                  background-color:var(--s2);background-size:cover;
                  background-position:center"></div>
      <div style="display:flex;align-items:flex-start;gap:5px;margin-bottom:2px">
        <div style="width:7px;height:7px;border-radius:50%;
                    background:${preset.color};flex-shrink:0;margin-top:2px"></div>
        <div class="preset-name" style="flex:1">${preset.name}</div>
        <button class="preset-share-btn" data-id="${preset.id}"
          style="background:none;border:none;color:var(--t3);cursor:pointer;
                 padding:0 1px;line-height:1;flex-shrink:0;font-size:11px"
          title="Copy share link for this preset">
          <i data-lucide="share-2" width="10" height="10"></i>
        </button>
        ${preset.userSaved ? `
          <button class="preset-delete-btn" data-id="${preset.id}"
            style="background:none;border:none;color:var(--t3);cursor:pointer;
                   padding:0 1px;line-height:1;flex-shrink:0;font-size:11px"
            title="Delete saved preset">
            <i data-lucide="x" width="10" height="10"></i>
          </button>
        ` : ''}
      </div>
      <div class="preset-expr">${exprShort}</div>
      <div class="preset-type ${typeClass}">${typeLabel}</div>
    `;

    _observeThumb(card.querySelector('.preset-thumb'), preset);

    // Share this single preset (mod-share.js builds the actual link)
    const shareBtn = card.querySelector('.preset-share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (!window.ModShare) return;
        const url = ModShare.getPresetShareURL(preset);
        navigator.clipboard.writeText(url).then(() => {
          if (window.ModToast) ModToast.show('Preset link copied', 'success');
        }).catch(() => {
          if (window.ModToast) ModToast.show('Could not copy link', 'error');
        });
      });
    }

    // Load on click
    card.addEventListener('click', e => {
      if (e.target.closest('.preset-delete-btn')) return;
      loadPreset(preset);
    });

    // Delete saved preset
    const delBtn = card.querySelector('.preset-delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        _deleteUserPreset(preset.id);
      });
    }

    // Hover color hint
    card.addEventListener('mouseenter', () => {
      card.style.borderColor = preset.color + '88';
    });
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = '';
    });

    return card;
  }

  // ══════════════════════════════════════════════════════
  // LOAD PRESET
  // ══════════════════════════════════════════════════════

  function loadPreset(preset) {
    if (!window.ModEquations) return;

    const eqOpts = {
      expr:  preset.expr,
      type:  preset.type,
      color: preset.color,
    };
    // Most presets are fine with addEquation's generic defaults, but some
    // (projectile motion needs t >= 0, not the default -3pi..3pi) need a
    // specific domain to be physically meaningful rather than just decorative.
    ['tMin', 'tMax', 'uMin', 'uMax', 'vMin', 'vMax'].forEach(key => {
      if (preset[key] !== undefined) eqOpts[key] = preset[key];
    });

    ModEquations.addEquation(eqOpts);

    // Auto-add needed sliders
    if (preset.needsT && window.ModSliders && !ModSliders.has('t')) {
      ModSliders.addSlider('t', 0, { min: 0, max: Math.PI * 2 });
    }
    if (preset.needsSliders && window.ModSliders) {
      preset.needsSliders.forEach(spec => {
        // Back-compat: a plain string still works and defaults to value 1.
        // Physics presets need real defaults (g=9.8, not 1), so a spec can
        // also be { name, value, min, max, step }.
        const name = typeof spec === 'string' ? spec : spec.name;
        if (ModSliders.has(name)) return;
        if (typeof spec === 'string') {
          ModSliders.addSlider(name, 1);
        } else {
          const opts = {};
          if (spec.min   !== undefined) opts.min   = spec.min;
          if (spec.max   !== undefined) opts.max   = spec.max;
          if (spec.step  !== undefined) opts.step  = spec.step;
          ModSliders.addSlider(name, spec.value ?? 1, opts);
        }
      });
    }

    if (window.ModToast) ModToast.show('Loaded: ' + preset.name, 'success');
  }

  // ══════════════════════════════════════════════════════
  // SAVE CURRENT AS PRESET
  // ══════════════════════════════════════════════════════

  function saveCurrentAsPreset() {
    if (!window.ModEquations) return;
    const eqs = ModEquations.getAll();
    if (!eqs.length) {
      if (window.ModToast) ModToast.show('No equations to save', 'error');
      return;
    }

    const name = prompt('Name for this preset:', 'My Graph ' + (_userPresets.length + 1));
    if (!name) return;

    // Save the first (or all) equations
    const first = eqs[0];
    const preset = {
      id:        'user-' + Date.now(),
      name:      name.trim(),
      expr:      first.expr,
      type:      first.type,
      color:     first.color,
      category:  'Saved',
      tags:      ['saved', 'user'],
      desc:      'User saved preset',
      userSaved: true,
    };

    _userPresets.push(preset);
    _saveUserPresets();
    _renderGrid();

    if (window.ModToast) ModToast.show('Preset saved: ' + preset.name, 'success');
  }

  // ══════════════════════════════════════════════════════
  // DELETE USER PRESET
  // ══════════════════════════════════════════════════════

  function _deleteUserPreset(id) {
    _userPresets = _userPresets.filter(p => p.id !== id);
    _saveUserPresets();
    _renderGrid();
    if (window.ModToast) ModToast.show('Preset deleted', 'info');
  }

  // ══════════════════════════════════════════════════════
  // PERSIST USER PRESETS
  // ══════════════════════════════════════════════════════

  function _saveUserPresets() {
    try {
      localStorage.setItem('g3d_presets', JSON.stringify(_userPresets));
    } catch {}
  }

  function _loadUserPresets() {
    try {
      const raw = localStorage.getItem('g3d_presets');
      if (raw) _userPresets = JSON.parse(raw);
    } catch {
      _userPresets = [];
    }
  }

  // ══════════════════════════════════════════════════════
  // IMPORT / EXPORT USER PRESETS (JSON)
  // ══════════════════════════════════════════════════════

  function exportUserPresets() {
    if (_userPresets.length === 0) {
      if (window.ModToast) ModToast.show('No saved presets to export', 'info');
      return;
    }
    const payload = { v: 1, exportedAt: Date.now(), presets: _userPresets };
    const a = document.createElement('a');
    a.download = 'graph3d-presets-' + Date.now() + '.json';
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    a.click();
    if (window.ModToast) ModToast.show('Presets exported', 'success');
  }

  function importUserPresets(jsonTextOrObject) {
    try {
      const payload = typeof jsonTextOrObject === 'string' ? JSON.parse(jsonTextOrObject) : jsonTextOrObject;
      const incoming = Array.isArray(payload) ? payload : payload.presets;
      if (!Array.isArray(incoming)) throw new Error('No presets array found');

      const existingIds = new Set(_userPresets.map(p => p.id));
      let added = 0;
      incoming.forEach(p => {
        if (!p || !p.expr || !p.type) return; // skip malformed entries rather than fail the whole import
        const id = existingIds.has(p.id) ? 'user-' + Date.now() + '-' + added : (p.id || 'user-' + Date.now() + '-' + added);
        _userPresets.push({
          id, name: p.name || 'Imported preset', expr: p.expr, type: p.type,
          color: p.color || '#3b82f6', category: 'Saved',
          tags: p.tags || ['imported'], desc: p.desc || 'Imported preset', userSaved: true,
        });
        existingIds.add(id);
        added++;
      });

      _saveUserPresets();
      _renderGrid();
      if (window.ModToast) ModToast.show(`Imported ${added} preset${added === 1 ? '' : 's'}`, 'success');
      return added;
    } catch (err) {
      if (window.ModToast) ModToast.show('Could not import — invalid file', 'error');
      return 0;
    }
  }

  function _triggerImportDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => importUserPresets(reader.result);
      reader.readAsText(file);
    });
    input.click();
  }

  // ══════════════════════════════════════════════════════
  // SEARCH (external trigger)
  // ══════════════════════════════════════════════════════

  function search(query) {
    _searchQuery = query.toLowerCase().trim();
    const inp = document.getElementById('preset-search');
    if (inp) inp.value = query;
    _renderGrid();
  }

  function filterByCategory(cat) {
    _activeCategory = cat;
    _renderGrid();
  }

  // ══════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════
  return {
    init,
    loadPreset,
    saveCurrentAsPreset,
    search,
    filterByCategory,
    exportUserPresets,
    importUserPresets,
    getBuiltin:    () => [...BUILTIN],
    getUserPresets: () => [..._userPresets],
    getCategories:  () => [...CATEGORIES],
  };

})();
