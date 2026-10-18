/* Node checks for live MBS location → region matching. */
const {
    matchLocationToMbsRegion,
    searchLocationSites,
    locationZoneFields,
    locationSuggestionValue,
    locationZoneNoteText,
    requireMatchedLocation
} = require('../js/location-catalogue.js');

let failed = 0;
function eq(actual, expected, label) {
    const ok = Object.is(actual, expected) || (actual && expected && JSON.stringify(actual) === JSON.stringify(expected));
    if (!ok) {
        failed += 1;
        console.error('FAIL', label, { actual, expected });
    } else {
        console.log('ok', label);
    }
}

function region(text) {
    const hit = matchLocationToMbsRegion(text);
    return hit ? hit.region : null;
}

function site(text) {
    const hit = matchLocationToMbsRegion(text);
    return hit ? hit.id : null;
}

eq(region(''), null, 'empty stays unmatched');
eq(region('   '), null, 'whitespace stays unmatched');
eq(region('Right cheek'), 2, 'right cheek → R2');
eq(site('Right cheek'), 'cheek', 'right cheek site');
eq(region('Left nose'), 1, 'left nose → R1');
eq(site('Left nose'), 'nose', 'left nose site');
eq(region('nasal ala'), 1, 'nasal ala → R1');
eq(region('left eyelid'), 1, 'eyelid → R1');
eq(region('right ear helix'), 1, 'ear → R1');
eq(region('left index finger'), 1, 'finger → R1');
eq(region('face'), 2, 'generic face → R2');
eq(region('left face'), 2, 'left face → R2');
eq(region('scalp vertex'), 2, 'scalp → R2');
eq(region('neck'), 2, 'neck → R2');
eq(region('right nipple'), 2, 'nipple → R2');
eq(region('left wrist'), 2, 'wrist → R2');
eq(region('dorsum of the hand'), 2, 'hand → R2');
eq(region('right knee'), 2, 'knee → R2');
eq(region('left shin'), 2, 'shin → R2');
eq(region('left calf'), 2, 'calf → R2');
eq(region('right ankle'), 2, 'ankle → R2');
eq(region('left foot'), 2, 'foot → R2');
eq(region('Left forearm'), 3, 'forearm → R3');
eq(region('upper arm'), 3, 'upper arm → R3');
eq(region('left chest'), 3, 'chest → R3');
eq(region('abdomen'), 3, 'abdomen → R3');
eq(region('lower back'), 3, 'back → R3');
eq(region('right breast'), 3, 'breast → R3');
eq(region('left shoulder'), 3, 'shoulder → R3');
eq(region('right thigh'), 3, 'thigh → R3');
eq(region('arm'), null, 'bare arm stays unmatched');
eq(region('leg'), null, 'bare leg stays unmatched');
eq(region('xyzzy'), null, 'unknown site unmatched');
eq(region('left nasal cheek'), 1, 'R1 nose wins over cheek');
eq(region('face nose'), 1, 'R1 nose wins over generic face');

const zone = locationZoneFields('Right cheek');
eq(zone.billingRegion, 2, 'locationZoneFields region');
eq(zone.bodyAreaId, 'cheek', 'locationZoneFields id');
eq(!!zone.bodyAreaLabel, true, 'locationZoneFields label present');
eq(locationZoneFields('arm').billingRegion, '', 'unmatched zone fields empty');

eq(locationSuggestionValue('left cheek', { label: 'Cheek' }), 'Left Cheek', 'keeps left laterality');
eq(locationSuggestionValue('RT nose', { label: 'Nose' }), 'Right Nose', 'keeps right laterality');
eq(locationSuggestionValue('cheek', { label: 'Cheek' }), 'Cheek', 'no laterality when none typed');

eq(locationZoneNoteText(null, { empty: true }), '', 'empty note is blank');
eq(locationZoneNoteText(null, { empty: false }).includes('maps to MBS'), true, 'unmatched note asks for a site');
eq(locationZoneNoteText({ region: 2, label: 'Cheek' }), 'Allocated to Region 2 — Cheek', 'matched note names the zone');

const cheekHits = searchLocationSites('chee');
eq(cheekHits.some((row) => row.id === 'cheek'), true, 'typeahead finds cheek');
eq(searchLocationSites('n').length === 0, true, 'one letter is not enough');
eq(searchLocationSites('nose')[0].region, 1, 'nose suggestion is region 1');

eq(requireMatchedLocation(''), null, 'require empty fails');
eq(requireMatchedLocation('arm'), null, 'require unmatched fails');
eq(requireMatchedLocation('Left nose').region, 1, 'require matched passes');

if (failed) {
    console.error(failed + ' check(s) failed');
    process.exit(1);
}
console.log('All location-catalogue checks passed.');
