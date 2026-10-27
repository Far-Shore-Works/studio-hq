# Object table: sources and reasoning

`data/objects.js` is what the game reads. This file says where each number came from. A test checks that every object in the table has a row here. Sourcing was done 2026-10-27 by web search; most pages are retailer or summary pages, not the rule books themselves, so "confidence" says how much to trust each row. Nothing here is a spec you could build from; it is good enough for a toy where players judge heavy versus floaty.

## How the numbers are used

- **mass** (kg), **area** (m^2, the cross-section the air sees) and **cd** (drag coefficient) give the drag constant `k = rho * cd * area / (2 * mass)`, with `rho = 1.225 kg/m^3` (sea-level standard atmosphere; [Cambridge engineering notes](https://www-mdp.eng.cam.ac.uk/web/library/enginfo/aerothermal_dvd_only/aero/atmos/atmos.html), [Wikipedia ISA table](https://en.wikipedia.org/wiki/International_Standard_Atmosphere)) and gravity 9.80665 m/s^2.
- Flight is quadratic drag: deceleration = `k * speed * velocity`. Spin, lift (Magnus effect) and tumbling are ignored on purpose; every object flies as if it were thrown without spin and holds its shape.
- **Area rules**: spheres use pi r^2. Boxes use one quarter of the surface area (the average shadow of a randomly turned box, Cauchy's rule), trimmed by judgment. Flat or odd shapes (tire, pillow, anvil, piano) are my estimate from the listed dimensions.
- **Cd rules**: smooth or rough ball about 0.5; blunt box 1.1 (cube about 1.05, flat plate 1.28, per [NASA Glenn shape effects page](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/shape-effects-on-drag/)); soccer ball and golf ball use their lower post-"drag crisis" values because they fly fast enough (a 2007 wind tunnel study put soccer balls near 0.23 above about 17 m/s, per a search summary; a golf ball is lower still). Constant Cd is a simplification: real balls change Cd with speed.
- **size** is the longest side, for the card text and sprite shape; the game also uses it for the hit radius, capped at 0.7 m.
- The card word for drag ("flies true", "feels the air", "floaty") comes from `k`: under 0.01 flies true, under 0.05 feels the air, above that floaty.

## The table

| id | Object | mass kg | area m^2 | Cd | size m | k (1/m) | class | max range m | confidence |
|---|---|---|---|---|---|---|---|---|---|
| piano | Grand piano | 345 | 2.4 | 1.1 | 2.11 | 0.0047 | flies true | 71 | medium |
| fridge | Refrigerator | 70 | 1.3 | 1.1 | 1.7 | 0.0125 | feels the air | 53 | low |
| anvil | Blacksmith anvil | 45.4 | 0.07 | 1.1 | 0.45 | 0.0010 | flies true | 87 | medium |
| tire | Car tire | 9 | 0.135 | 1.0 | 0.63 | 0.0092 | flies true | 59 | medium |
| block | Cinder block | 17.2 | 0.1 | 1.1 | 0.4 | 0.0039 | flies true | 74 | medium |
| bowling | Bowling ball | 7.26 | 0.0373 | 0.5 | 0.218 | 0.0016 | flies true | 85 | high |
| golf | Golf ball | 0.04593 | 0.00143 | 0.27 | 0.0427 | 0.0051 | flies true | 70 | high |
| tennis | Tennis ball | 0.0577 | 0.0035 | 0.6 | 0.067 | 0.0223 | feels the air | 41 | high |
| soccer | Soccer ball | 0.43 | 0.0379 | 0.25 | 0.22 | 0.0135 | feels the air | 51 | high |
| volleyball | Volleyball | 0.27 | 0.0343 | 0.3 | 0.21 | 0.0233 | feels the air | 40 | high |
| basketball | Basketball | 0.624 | 0.0445 | 0.5 | 0.238 | 0.0218 | feels the air | 41 | high |
| pingpong | Ping-pong ball | 0.0027 | 0.001257 | 0.5 | 0.04 | 0.1426 | floaty | 14 | high |
| paperball | Paper ball | 0.005 | 0.00283 | 0.5 | 0.06 | 0.1733 | floaty | 12 | medium |
| pillow | Bed pillow | 0.65 | 0.2 | 1.1 | 0.66 | 0.2073 | floaty | 10 | low |

"Max range" is the furthest a full pull goes over a few launch angles, with the slingshot 2.2 m up. It decides which objects can appear on a given day (the tower has to be within about 80% of it).

## Row by row

**piano (Grand piano)**: Steinway Model B, 211 cm long, about 148 cm wide, about 345 kg (760 lb) net, per several dealer pages ([M. Steinert](https://msteinert.com/steinway-model-b), [Linde Bladen](https://www.lindebladpiano.com/pianos/steinway/b/?page=2), [Daynes](https://daynesmusic.com/?p=2427)). Chris's example card said 320 kg; the sourced figure is 345 kg, so the table uses 345. Area 2.4 m^2 is my estimate: a box of 2.11 x 1.48 x 1.0 m has a quarter-surface of 3.4 m^2, trimmed for the curved side and open lid. Cd 1.1 blunt box. Medium confidence on the area.

**fridge (Refrigerator)**: a 66 cm wide, about 170 cm tall top-freezer. Listed weights run 45 to 84 kg: Beko 66 cm model 56 kg ([Beko](https://beko.com/ph-en/products/fridge-freezers/fridge-freezer-freezer-top-66-cm-rdnt371e50vzk)), Summit 26-inch models 82 and 84 kg ([Summit](https://summitappliance.com/catalog/model/FF1427W)), Indesit 45 kg ([Back Market](https://www.backmarket.ie/en-ie/p/refrigerators-with-top-freezers-indesit-tiaa-12-v-si/a6223fc6-a911-4194-8742-f0c196dad340)). 70 kg is a middle value. Retailer weights are unverified. Low confidence.

**anvil (Blacksmith anvil)**: the common 100 lb (45.4 kg) anvil. Dimensions vary by maker: face about 12 to 16.5 in, height 8 to 10 in ([Emerson, knifemaking.com](https://knifemaking.com/products/ea100-emerson-100lb-anvil), [Vevor 45 kg listing](https://uk.vevor.com/cast-iron-anvil-c_10826/vevor-iron-anvil-blacksmith-single-beck-cast-iron-100-lb-45kg-w-1-2in-square-hole-p_010786815942)). Size 0.45 m long, shadow area 0.07 m^2 (estimate).

**tire (Car tire)**: a 205/55R16 passenger tire: overall diameter about 632 mm, section width about 214 mm, weight 7.3 to 10 kg depending on the model ([tiresize.com](https://tiresize.com/tires/Bridgestone/Potenza-RE760-Sport-205-55R16.htm) and retailer listings). Used 9 kg. Area 0.135 m^2 is diameter times width (side-on); Cd 1.0.

**block (Cinder block)**: normal-weight hollow 8x8x16 concrete block: minimum 38 lb (17.2 kg) per a [Lowe's listing](https://www.lowes.com/pd/Common-8-in-x-8-in-x-16-in-Actual-7-625-in-x-7-625-in-x-15-625-in-Standard-Cored-Concrete-Block/3608978); other pages say 28 to 40 lb. Actual size about 0.4 x 0.2 x 0.2 m, so surface 0.4 m^2, quarter 0.1 m^2.

**bowling (Bowling ball)**: USBC limits: maximum 16 lb (7.26 kg), diameter about 8.5 to 8.595 in (about 21.8 cm) ([bowlingball.com specs summary](https://www.bowlingball.com/bowlversity/Useful-Specifications-For-Bowling-Balls), [Wikipedia](https://en.wikipedia.org/wiki/Bowling_ball)). I used the 16 lb maximum and 21.8 cm. The page said 8.5 in is the minimum, not a fixed size. Area pi r^2; Cd 0.5.

**golf (Golf ball)**: R&A and USGA rules: weight no more than 45.93 g, diameter at least 42.67 mm ([R&A Part 4](https://www.randa.org/roe/the-rules-of-equipment/part-4-conformance-of-balls), [USGA Appendix III](https://www.usga.org/etc/designs/usga/content/rule-book/rule-14324.html)). Cd 0.27 is my pick for a dimpled ball above the drag crisis (the sources I opened gave no golf Cd number). Spin and lift are ignored, so this ball flies shorter than a real, backspun drive.

**tennis (Tennis ball)**: ITF type 2 ball: mass 56.0 to 59.4 g, diameter 6.54 to 6.86 cm (several secondary sites; the ITF appendix itself was not opened, and one older article quotes slightly different numbers). Used 57.7 g, 6.7 cm. Cd: wind tunnel work on new balls gives 0.55 to 0.7 because of the fuzz ([MDPI proceedings](https://mdpi.com/2504-3900/2/6/265/htm), Mehta's abstract via [APS](https://meetings-archive.aps.org/dfd/2009/bw/5/)); used 0.6.

**soccer (Soccer ball)**: FIFA/IFAB size 5: circumference 68 to 70 cm, mass 410 to 450 g (secondary sites; the Laws of the Game text was not opened). Used 430 g, 22 cm across. Cd 0.25, near the supercritical value found in wind tunnel studies ([physicstoday.aip.org](https://physicstoday.aip.org/news/aerodynamics-in-the-beautiful-game)).

**volleyball (Volleyball)**: indoor match ball: circumference 65 to 67 cm, 260 to 280 g (retailer pages such as [Mikasa V330W](https://www.buffalo.nl/en/volleyball-mikasa-v330w); the FIVB rule book was not opened). Used 270 g, 21 cm. Cd 0.3 (my estimate; a smooth-panel ball is close to the soccer ball).

**basketball (Basketball)**: size 7 (NBA and men's FIBA): circumference about 29.5 in (74.9 cm), about 22 oz (624 g). The search results were SEO pages and the FIBA weight range conflicted (567 to 650 g), so there is no clean official source here (best of them: [Hoops Basket](https://www.hoopsbasket.com/blogs/hoops-basketball/nba-basketball-size-official-dimensions)). Used 624 g, 23.8 cm. Cd 0.5.

**pingpong (Ping-pong ball)**: ITTF: 40 mm diameter, 2.7 g (quoted by several sites from the rules, for example [Wikipedia: Table tennis](https://en.wikipedia.org/wiki/Table_tennis); the ITTF handbook itself was not opened). Cd 0.5 estimate.

**paperball (Paper ball)**: one crumpled sheet of A4 (210 x 297 mm = 0.0624 m^2) at 80 g/m^2 weighs 4.99 g, about 5 g ([papersizes.org](https://www.papersizes.org/weight-of-sheets.htm) and the gsm definition). The crumpled diameter, about 6 cm, is my estimate. Cd 0.5.

**pillow (Bed pillow)**: standard bed pillow 20 x 26 in (51 x 66 cm); weights vary 1.4 to 3 lb depending on fill ([Target listing 1.38 lb](https://www.target.com/p/-/A-1006037516), [Pacific Coast Feather](https://www.webstaurantstore.com/restful-nights-grand-loft-20-x-26-standard-size-synthetic-hotel-pillow/32765494STEA.html)). Used 0.65 kg. Area 0.2 m^2 (about half the face area, as it flies tilted); Cd 1.1. Low confidence on area and Cd.

## Considered and left out

- **Beach ball** (40 cm): listings range from 54 g to 183 g with no standard, and at full pull it cannot reach even the closest tower (max range under 7 m). Left out until a closer tower or a stronger launch exists.
- **Watermelon**: weights from 3 to 11 kg depending on variety, only content-farm sources, no clean number. Left out.

## Adding an object

1. Find mass and size from a rule book or a maker's spec sheet; write the link in the row.
2. Estimate the shadow area and a Cd from the shape; say how.
3. Add it to `data/objects.js` and here. Run `npm test`.
4. Adding objects changes which objects the date seed picks from, so the days in `data/schedule.json` that are already published must not be re-rolled. Add objects before building the schedule, or give each scheduled day its objects explicitly.
