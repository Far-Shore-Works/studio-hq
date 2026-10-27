// The object table. One row per real object. Sources and reasoning: data/objects.md.
// Units: mass in kg, area in m^2 (the cross-section the air sees), cd is dimensionless.
// size is the longest dimension in metres (for the card and for sprite scale).
// Anything here may change before launch; keep objects.md in step (a test checks it).
export const OBJECTS = [
  { id: 'piano',      name: 'Grand piano',        mass: 345,    area: 2.4,     cd: 1.1,  size: 2.11,  conf: 'medium' },
  { id: 'fridge',     name: 'Refrigerator',       mass: 70,     area: 1.3,     cd: 1.1,  size: 1.7,   conf: 'low' },
  { id: 'anvil',      name: 'Blacksmith anvil',   mass: 45.4,   area: 0.07,    cd: 1.1,  size: 0.45,  conf: 'medium' },
  { id: 'tire',       name: 'Car tire',           mass: 9,      area: 0.135,   cd: 1.0,  size: 0.63,  conf: 'medium' },
  { id: 'block',      name: 'Cinder block',       mass: 17.2,   area: 0.1,     cd: 1.1,  size: 0.4,   conf: 'medium' },
  { id: 'bowling',    name: 'Bowling ball',       mass: 7.26,   area: 0.0373,  cd: 0.5,  size: 0.218, conf: 'high' },
  { id: 'golf',       name: 'Golf ball',          mass: 0.04593, area: 0.001430, cd: 0.27, size: 0.0427, conf: 'high' },
  { id: 'tennis',     name: 'Tennis ball',        mass: 0.0577, area: 0.00350, cd: 0.6,  size: 0.067, conf: 'high' },
  { id: 'soccer',     name: 'Soccer ball',        mass: 0.43,   area: 0.0379,  cd: 0.25, size: 0.22,  conf: 'high' },
  { id: 'volleyball', name: 'Volleyball',         mass: 0.27,   area: 0.0343,  cd: 0.3,  size: 0.21,  conf: 'high' },
  { id: 'basketball', name: 'Basketball',         mass: 0.624,  area: 0.0445,  cd: 0.5,  size: 0.238, conf: 'high' },
  { id: 'pingpong',   name: 'Ping-pong ball',     mass: 0.0027, area: 0.001257, cd: 0.5, size: 0.04,  conf: 'high' },
  { id: 'paperball',  name: 'Paper ball',         mass: 0.005,  area: 0.00283, cd: 0.5,  size: 0.06,  conf: 'medium' },
  { id: 'pillow',     name: 'Bed pillow',         mass: 0.65,   area: 0.2,     cd: 1.1,  size: 0.66,  conf: 'low' },
];
