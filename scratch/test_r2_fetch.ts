async function testR2Fetch() {
  const url = 'https://pub-a352e674a992412fa243598ffd6b659c.r2.dev/W_2340_01_Pied.jpg'
  try {
    const res = await fetch(url)
    console.log('Status:', res.status)
    if (res.ok) {
      const buf = await res.arrayBuffer()
      console.log('Size:', buf.byteLength)
    } else {
      console.log('Error:', await res.text())
    }
  } catch (e) {
    console.error('Fetch failed:', e)
  }
}

testR2Fetch()
