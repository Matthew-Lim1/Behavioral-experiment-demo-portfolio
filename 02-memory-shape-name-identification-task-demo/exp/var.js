let f_images = [];
let m_images = [];

for (i=1; i<48; i++){
  f_images.push('images/forgettable/F' + ("00" + i).slice(-2) + '.jpg');
}
shuffle(f_images);

for (i=1; i<46; i++){
  m_images.push('images/memorable/M' + ("00" + i).slice(-2) + '.jpg');
}
shuffle(m_images);

let std_images = f_images.concat(m_images);

