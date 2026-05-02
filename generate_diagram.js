const fs = require('fs');
const https = require('https');
const str = `graph TD
Input[Artist Input] --> DB[(Database)]
DB --> img[txtImageNameLink]
DB --> pub[is_public]
DB --> stat[statusId]
DB --> exp[Exposable]

img --> checkImg{Does Image Exist?}
pub --> checkPub{is_public == TRUE?}

HUB[Atelier Hub]
WORKS[/works Website]
PORTFOLIO[/portfolio]

stat -->|Determines category| HUB
checkImg -->|If False: Placeholder| HUB

checkPub -->|FALSE| Hide[Hidden from Public Sites]
checkPub -->|TRUE| checkImg2{Does Image Exist?}

checkImg2 -->|FALSE| Hide
checkImg2 -->|TRUE| ThemeMatch{Theme Match?}

ThemeMatch -->|Fuzzy Match| PORTFOLIO
ThemeMatch -->|Fuzzy Match| WORKS

exp -.->|Exhibition physical filter| HUB`;

// Convert to Base64 in standard format
const encoded = Buffer.from(str).toString('base64');
const url = 'https://mermaid.ink/img/' + encoded;

https.get(url, (res) => {
  const path = 'Atelier_Visibility_Diagram.png';
  const filePath = fs.createWriteStream(path);
  res.pipe(filePath);
  filePath.on('finish', () => {
    filePath.close();
    console.log('Saved to ' + path);
  });
}).on('error', (err) => {
  console.error('Error fetching diagram:', err);
});
