// Importation des modules nécessaires
const fs = require('fs');
const { js2xml } = require('xml-js');

// Chemins vers les fichiers d'entrée et de sortie
const inputJSONPath = './data/data.json';  // Chemin vers le fichier JSON d'entrée
const outputXMLPath = './output/output.xml';  // Chemin vers le fichier XML de sortie

// Lecture du fichier JSON d'entrée
const jsonData = fs.readFileSync(inputJSONPath, 'utf-8');
const jsonObject = JSON.parse(jsonData);

// Liste des clés qui doivent avoir le préfixe "rsm:"
const rsmKeys = [
    'CrossIndustryInvoice',
    'ExchangedDocumentContext',
    'ExchangedDocument',
    'SupplyChainTradeTransaction'
];

// Liste des clés qui doivent avoir le préfixe "udt:"
const udtKeys = ['DateTimeString', 'Indicator'];

/**
 * Fonction pour ajouter des préfixes aux clés JSON selon les spécifications.
 * Cette fonction ajoute des préfixes "ram:", "rsm:" ou "udt:" aux clés appropriées.
 *
 * @param {Object} obj - L'objet JSON à traiter.
 * @param {boolean} forceRam - Si vrai, force l'utilisation du préfixe "ram:" pour toutes les clés imbriquées.
 * @returns {Object} - L'objet JSON avec les clés préfixées.
 */
function addPrefixes(obj, forceRam = false) {
    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            let prefix;
            if (forceRam) {
                prefix = 'ram';
            } else if (udtKeys.includes(key)) {
                prefix = 'udt';
            } else if (rsmKeys.includes(key)) {
                prefix = 'rsm';
            } else {
                prefix = 'ram';
            }

            let newKey = `${prefix}:${key}`;

            // Cas spéciaux où des attributs doivent être extraits et convertis
            const specialCases = {
                "DateTimeString": "@format",
                "GlobalID": "@schemeID",
                "BilledQuantity": "@unitCode",
                "ID": "@schemeID",
                "URIID": "@schemeID",
                "TaxTotalAmount": "@currencyID"
            };

            if (specialCases[key] && obj[key].hasOwnProperty(specialCases[key])) {
                obj[newKey] = {
                    _attributes: { [specialCases[key].substring(1)]: obj[key][specialCases[key]] },
                    _text: obj[key]["#text"]
                };
                delete obj[key];
            } else {
                if (key !== newKey) {
                    obj[newKey] = obj[key];
                    delete obj[key];
                }

                if (Array.isArray(obj[newKey])) {
                    obj[newKey].forEach(item => {
                        addPrefixes(item, forceRam);
                    });
                } else if (typeof obj[newKey] === 'object') {
                    addPrefixes(obj[newKey], forceRam || newKey === "rsm:IncludedSupplyChainTradeLineItem");
                }
            }
        }
    }
    return obj;
}

// Appliquer la fonction addPrefixes à l'objet JSON pour ajouter les préfixes nécessaires
const prefixedJSON = addPrefixes(jsonObject);

// Ajout des espaces de noms au JSON préfixé
prefixedJSON["rsm:CrossIndustryInvoice"]._attributes = {
    "xmlns:qdt": "urn:un:unece:uncefact:data:standard:QualifiedDataType:100",
    "xmlns:ram": "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
    "xmlns:rsm": "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
    "xmlns:udt": "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100",
    "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance"
};

// Options pour convertir le JSON en XML
const xmlOptions = {
    compact: true,
    spaces: 4,
    declaration: {
        encoding: "UTF-8",
        version: "1.0"
    }
};

// Conversion de l'objet JSON préfixé en XML
const xmlContent = js2xml(prefixedJSON, xmlOptions);

// Ecriture du contenu XML dans un fichier de sortie
fs.writeFileSync(outputXMLPath, xmlContent, 'utf-8');

// Message de confirmation
console.log(`Factur-X XML généré avec succès: ${outputXMLPath}`);
