// Gomulu populer siteler (cevrimdisi oneri/tamamlama icin). Format: "alan.adi|Ad". Kullanici gecmisi bunlarin ustundedir.
const RAW = `google.com|Google
youtube.com|YouTube
gmail.com|Gmail
mail.google.com|Gmail Inbox
drive.google.com|Google Drive
docs.google.com|Google Docs
maps.google.com|Google Maps
translate.google.com|Google Translate
calendar.google.com|Google Calendar
meet.google.com|Google Meet
github.com|GitHub
gitlab.com|GitLab
bitbucket.org|Bitbucket
stackoverflow.com|Stack Overflow
developer.mozilla.org|MDN Web Docs
npmjs.com|npm
nodejs.org|Node.js
react.dev|React
nextjs.org|Next.js
vitejs.dev|Vite
vuejs.org|Vue.js
svelte.dev|Svelte
angular.dev|Angular
typescriptlang.org|TypeScript
tailwindcss.com|Tailwind CSS
electronjs.org|Electron
vercel.com|Vercel
netlify.com|Netlify
cloudflare.com|Cloudflare
aws.amazon.com|AWS
azure.microsoft.com|Azure
cloud.google.com|Google Cloud
firebase.google.com|Firebase
supabase.com|Supabase
docker.com|Docker
hub.docker.com|Docker Hub
kubernetes.io|Kubernetes
postgresql.org|PostgreSQL
mongodb.com|MongoDB
redis.io|Redis
spring.io|Spring
openai.com|OpenAI
chatgpt.com|ChatGPT
claude.ai|Claude
anthropic.com|Anthropic
gemini.google.com|Gemini
huggingface.co|Hugging Face
perplexity.ai|Perplexity
figma.com|Figma
notion.so|Notion
linear.app|Linear
slack.com|Slack
discord.com|Discord
zoom.us|Zoom
trello.com|Trello
atlassian.com|Atlassian
jira.com|Jira
medium.com|Medium
dev.to|DEV Community
news.ycombinator.com|Hacker News
reddit.com|Reddit
twitter.com|Twitter
x.com|X
facebook.com|Facebook
instagram.com|Instagram
linkedin.com|LinkedIn
tiktok.com|TikTok
pinterest.com|Pinterest
twitch.tv|Twitch
whatsapp.com|WhatsApp
web.whatsapp.com|WhatsApp Web
telegram.org|Telegram
web.telegram.org|Telegram Web
netflix.com|Netflix
spotify.com|Spotify
open.spotify.com|Spotify Web Player
disneyplus.com|Disney+
primevideo.com|Prime Video
blutv.com|BluTV
exxen.com|Exxen
gain.tv|Gain
tabii.com|Tabii
amazon.com|Amazon
amazon.com.tr|Amazon Türkiye
ebay.com|eBay
aliexpress.com|AliExpress
hepsiburada.com|Hepsiburada
trendyol.com|Trendyol
n11.com|n11
sahibinden.com|Sahibinden
letgo.com|letgo
yemeksepeti.com|Yemeksepeti
getir.com|Getir
migros.com.tr|Migros
a101.com.tr|A101
bim.com.tr|BİM
sok.com.tr|ŞOK
teknosa.com|Teknosa
mediamarkt.com.tr|MediaMarkt
vatanbilgisayar.com|Vatan Bilgisayar
itopya.com|İtopya
incehesap.com|İnceHesap
cimri.com|Cimri
akakce.com|Akakçe
epey.com|Epey
decathlon.com.tr|Decathlon
lcwaikiki.com|LC Waikiki
defacto.com.tr|DeFacto
koton.com|Koton
boyner.com.tr|Boyner
morhipo.com|Morhipo
ciceksepeti.com|ÇiçekSepeti
kitapyurdu.com|Kitapyurdu
idefix.com|idefix
dr.com.tr|D&R
turkiye.gov.tr|e-Devlet
gib.gov.tr|Gelir İdaresi Başkanlığı
sgk.gov.tr|SGK
meb.gov.tr|MEB
osym.gov.tr|ÖSYM
ais.osym.gov.tr|ÖSYM AIS
mhrs.gov.tr|MHRS
nvi.gov.tr|Nüfus ve Vatandaşlık
egm.gov.tr|Emniyet Genel Müdürlüğü
ptt.gov.tr|PTT
thy.com|Türk Hava Yolları
turkishairlines.com|Turkish Airlines
pegasus.com|Pegasus
flypgs.com|Pegasus Hava Yolları
tcddtasimacilik.gov.tr|TCDD Taşımacılık
obilet.com|Obilet
enuygun.com|Enuygun
ucuzabilet.com|Ucuzabilet
booking.com|Booking.com
airbnb.com|Airbnb
tripadvisor.com.tr|Tripadvisor
trivago.com.tr|Trivago
setur.com.tr|Setur
etstur.com|ETS Tur
jolly.com.tr|Jolly
ziraatbank.com.tr|Ziraat Bankası
isbank.com.tr|İş Bankası
garantibbva.com.tr|Garanti BBVA
akbank.com|Akbank
yapikredi.com.tr|Yapı Kredi
qnb.com.tr|QNB
denizbank.com|DenizBank
halkbank.com.tr|Halkbank
vakifbank.com.tr|VakıfBank
teb.com.tr|TEB
enpara.com|Enpara
papara.com|Papara
paycell.com.tr|Paycell
iyzico.com|iyzico
paytr.com|PayTR
binance.com|Binance
btcturk.com|BtcTurk
paribu.com|Paribu
coinmarketcap.com|CoinMarketCap
tradingview.com|TradingView
investing.com|Investing.com
bloomberght.com|Bloomberg HT
borsaistanbul.com|Borsa İstanbul
kap.org.tr|KAP
tcmb.gov.tr|TCMB
hurriyet.com.tr|Hürriyet
milliyet.com.tr|Milliyet
sabah.com.tr|Sabah
sozcu.com.tr|Sözcü
cumhuriyet.com.tr|Cumhuriyet
haberturk.com|Habertürk
ntv.com.tr|NTV
cnnturk.com|CNN Türk
trthaber.com|TRT Haber
aa.com.tr|Anadolu Ajansı
dha.com.tr|DHA
bbc.com|BBC
bbc.com/turkce|BBC Türkçe
cnn.com|CNN
nytimes.com|The New York Times
theguardian.com|The Guardian
reuters.com|Reuters
dw.com|Deutsche Welle
webtekno.com|Webtekno
shiftdelete.net|ShiftDelete.Net
donanimhaber.com|DonanımHaber
log.com.tr|LOG
technopat.net|Technopat
chip.com.tr|CHIP
eksisozluk.com|Ekşi Sözlük
inci.sozluk.com|İnci Sözlük
onedio.com|Onedio
r10.net|R10
swarmapp.com|Swarm
wikipedia.org|Wikipedia
tr.wikipedia.org|Vikipedi
en.wikipedia.org|Wikipedia (English)
tdk.gov.tr|TDK
sozluk.gov.tr|TDK Sözlük
tureng.com|Tureng
deepl.com|DeepL
translate.yandex.com.tr|Yandex Çeviri
yandex.com.tr|Yandex
yandex.com|Yandex
bing.com|Bing
duckduckgo.com|DuckDuckGo
brave.com|Brave
search.brave.com|Brave Search
mozilla.org|Mozilla
outlook.com|Outlook
outlook.live.com|Outlook Mail
office.com|Microsoft 365
microsoft.com|Microsoft
live.com|Microsoft Live
onedrive.live.com|OneDrive
teams.microsoft.com|Microsoft Teams
apple.com|Apple
icloud.com|iCloud
dropbox.com|Dropbox
wetransfer.com|WeTransfer
canva.com|Canva
unsplash.com|Unsplash
pexels.com|Pexels
dribbble.com|Dribbble
behance.net|Behance
coursera.org|Coursera
udemy.com|Udemy
khanacademy.org|Khan Academy
edx.org|edX
duolingo.com|Duolingo
leetcode.com|LeetCode
hackerrank.com|HackerRank
codepen.io|CodePen
codesandbox.io|CodeSandbox
stackblitz.com|StackBlitz
replit.com|Replit
regex101.com|regex101
caniuse.com|Can I use
jsonformatter.org|JSON Formatter
epicgames.com|Epic Games
store.steampowered.com|Steam
steamcommunity.com|Steam Community
roblox.com|Roblox
ea.com|EA
playstation.com|PlayStation
xbox.com|Xbox
fenerbahce.org|Fenerbahçe
galatasaray.org|Galatasaray
bjk.com.tr|Beşiktaş
trabzonspor.org.tr|Trabzonspor
tff.org|TFF
mackolik.com|Mackolik
sofascore.com|SofaScore
flashscore.com.tr|Flashscore
ntvspor.net|NTV Spor
fanatik.com.tr|Fanatik
sporx.com|Sporx
iddaa.com|İddaa
nesine.com|Nesine
havadurumu.mgm.gov.tr|MGM Hava Durumu
mgm.gov.tr|MGM
kandilli.edu.tr|Kandilli Rasathanesi
afad.gov.tr|AFAD
eczaneler.gen.tr|Nöbetçi Eczane
saglik.gov.tr|Sağlık Bakanlığı
yolcu360.com|Yolcu360
arabam.com|Arabam.com
otokoc.com.tr|Otokoç
emlakjet.com|Emlakjet
zingat.com|Zingat
hepsiemlak.com|Hepsiemlak
kariyer.net|Kariyer.net
yenibiris.com|Yenibiris
secretcv.com|SecretCV
indeed.com|Indeed
glassdoor.com|Glassdoor
turkcell.com.tr|Turkcell
vodafone.com.tr|Vodafone
turktelekom.com.tr|Türk Telekom
superonline.net|Superonline
turknet.net.tr|TurkNet
bimcell.com|Bimcell
spotify.com.tr|Spotify TR
muzikbox.com|Müzik
fizy.com|fizy
youtubemusic.com|YouTube Music
music.youtube.com|YouTube Music
studio.youtube.com|YouTube Studio
analytics.google.com|Google Analytics
search.google.com|Google Search Console
ads.google.com|Google Ads
play.google.com|Google Play
photos.google.com|Google Photos
news.google.com|Google News
scholar.google.com|Google Scholar
keep.google.com|Google Keep
colab.research.google.com|Google Colab
console.cloud.google.com|Google Cloud Console
console.aws.amazon.com|AWS Console
portal.azure.com|Azure Portal
dash.cloudflare.com|Cloudflare Dashboard
app.netlify.com|Netlify Dashboard
console.firebase.google.com|Firebase Console
railway.app|Railway
render.com|Render
fly.io|Fly.io
heroku.com|Heroku
digitalocean.com|DigitalOcean
hetzner.com|Hetzner
godaddy.com|GoDaddy
namecheap.com|Namecheap
turhost.com|Turhost
natro.com|Natro
isimtescil.net|İsimtescil
stripe.com|Stripe
paypal.com|PayPal
wise.com|Wise
revolut.com|Revolut
sentry.io|Sentry
datadoghq.com|Datadog
grafana.com|Grafana
posthog.com|PostHog
swagger.io|Swagger
postman.com|Postman
insomnia.rest|Insomnia
jwt.io|jwt.io
crontab.guru|crontab guru`
export interface PopularSite { host: string; name: string }
export const POPULAR: PopularSite[] = RAW.split('\n').map((l) => { const i = l.indexOf('|'); return { host: l.slice(0, i), name: l.slice(i + 1) } })
