var currentMarker = null;  // Initialisation à null pour stocker le marqueur courant
var currentGeoJSONLayer = null; // Stocker la couche GeoJSON actuelle

// Définir les projections (exemple pour EPSG:3297 - RGPF / UTM zone 6S)
proj4.defs([
    ['EPSG:3297', '+proj=utm +zone=6 +south +datum=WGS84 +units=m +no_defs']
]);

// Création de la carte centrée sur Tahiti avec les contrôles à droite
var map = L.map('map', {
    zoomControl: false // Désactive le contrôle de zoom par défaut
}).setView([-17.6509, -149.4260], 11);

// Ajout du contrôle de zoom à droite
L.control.zoom({
    position: 'topright' // Place le contrôle de zoom en haut à droite
}).addTo(map);

// Couches de base
var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});

var satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});

osm.addTo(map);

var baseMaps = {
    "OpenStreetMap": osm,
    "Satellite": satellite
};

L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map); // Place le contrôle des couches en haut à droite

// Fonction pour charger automatiquement le fichier CSV depuis Dropbox à l'ouverture de la page
function loadCSVFromDropbox(url) {
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur lors du chargement du fichier CSV.');
            }
            return response.text();
        })
        .then(csvText => {
            // Parser le fichier CSV avec PapaParse
            Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                complete: function(results) {
                    console.log("Fichier CSV importé avec succès:", results.data);
                    document.getElementById('import-status').textContent = "Base de données importée avec succès";
                    processData(results.data); // Appel de ta fonction processData pour traiter le fichier CSV
                }
            });
        })
        .catch(error => {
            console.error('Erreur :', error);
            alert("Impossible de charger le fichier CSV depuis Dropbox.");
        });
}

// URL directe du fichier CSV sur Dropbox (modifié pour Dropbox)
var dropboxCSVURL = "https://dl.dropboxusercontent.com/scl/fi/7f28181yqwi4wch0th1w6/Base-de-donn-es-solaire-TAHITIv4.csv?rlkey=6grgq38s4frrch5h73zefat7y&st=59akhvxg&dl=1";

// Charger automatiquement le fichier CSV lors du chargement de la page
window.onload = function() {
    loadCSVFromDropbox(dropboxCSVURL);
};

// Fonction pour charger le fichier GeoJSON depuis Dropbox
function loadGeoJSONFromDropbox(url) {
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur lors du chargement du fichier GeoJSON depuis Dropbox.');
            }
            return response.json();
        })
        .then(data => {
            var geojsonLayer = L.geoJSON(data).addTo(map);
            map.fitBounds(geojsonLayer.getBounds());
            console.log("GeoJSON chargé avec succès.");
        })
        .catch(error => {
            console.error('Erreur :', error);
            alert("Impossible de charger le fichier GeoJSON.");
        });
}

// Objet de correspondance entre les valeurs PosteHTABT et les URLs Dropbox des fichiers GeoJSON
const geojsonLinks = {
    "02C0011": "https://dl.dropboxusercontent.com/scl/fi/tb2mmukxq0xzv8n6mb1ha/02C0011.geojson?rlkey=0t4qjwd2e3tcxzcxwrlpff9mh&st=savbukdm&dl=1",
    
    // Ajoutez d'autres correspondances ici pour chaque PosteHTABT
};

// Fonction pour charger le fichier GeoJSON associé au PosteHTABT
function loadGeoJSONForPosteHTABT(PosteHTABT) {
    const geojsonURL = geojsonLinks[PosteHTABT]; // Trouve l'URL correspondante

    if (geojsonURL) {
        fetch(geojsonURL)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Erreur lors du chargement du fichier GeoJSON.');
                }
                return response.json();
            })
            .then(data => {
                // Supprimez l'ancienne couche GeoJSON si elle existe
                if (currentGeoJSONLayer) {
                    map.removeLayer(currentGeoJSONLayer);
                }

                // Ajoutez la nouvelle couche GeoJSON à la carte
                currentGeoJSONLayer = L.geoJSON(data).addTo(map);
                map.fitBounds(currentGeoJSONLayer.getBounds());

                console.log("GeoJSON chargé avec succès.");
            })
            .catch(error => {
                console.error('Erreur :', error);
                alert("Impossible de charger le fichier GeoJSON pour le PosteHTABT " + PosteHTABT);
            });
    } else {
        console.log('Aucun fichier GeoJSON trouvé pour le PosteHTABT :', PosteHTABT);
    }
}

// Fonction pour convertir les coordonnées X,Y en latitude et longitude
function convertXYtoLatLng(x, y) {
    var [longitude, latitude] = proj4('EPSG:3297', 'EPSG:4326', [x, y]);
    return {
        lat: latitude,
        lng: longitude
    };
}

// Créer une icône légèrement plus grande pour les marqueurs
var smallIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    iconSize: [16, 26],  // Augmente la taille de l'icône (largeur, hauteur)
    iconAnchor: [8, 26],  // Point d'ancrage de l'icône
    popupAnchor: [0, -26]  // Position du popup par rapport à l'icône
});

// Fonction pour ajouter un label au-dessus du marqueur
function addLabelToMarker(marker, label) {
    var labelMarker = L.marker(marker.getLatLng(), {
        icon: L.divIcon({
            className: 'leaflet-marker-label',
            html: label,
            iconSize: [60, 20],
            iconAnchor: [35, -10]  // Position au-dessus du marqueur
        })
    }).addTo(map);

    return labelMarker;  // Renvoie le label pour pouvoir le gérer plus tard
}

// Fonction pour mettre à jour la fenêtre de propriété
function updatePropertyWindow(title, content) {
    document.getElementById('property-title').innerText = title;
    document.getElementById('property-content').innerHTML = content;
    document.getElementById('property-window').style.display = 'block';
}

// Fonction pour charger et parser le fichier CSV à partir de l'input file
document.getElementById('file-input').addEventListener('change', function(event) {
    var file = event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
        var csvText = e.target.result;
        Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            complete: function(results) {
                console.log("Fichier CSV importé avec succès:", results.data);
                document.getElementById('import-status').textContent = "Base de données importée avec succès";
                processData(results.data); // Traiter les données importées
            }
        });
    };
    reader.readAsText(file);
});

// Ajoute un événement au clic sur le bouton d'importation
document.getElementById('import-button').addEventListener('click', function() {
    document.getElementById('file-input').click(); // Simule un clic sur l'input file
});

// Déclarez markers au niveau global
var markers = [];  // Initialisez la variable markers comme un tableau vide

// Fonction pour traiter les données CSV importées
function processData(data) {
    data.forEach(function(item) {
        if (item.X && item.Y && typeof item.Reference === 'string') {
            var coords = convertXYtoLatLng(item.X, item.Y);

            // Vérification si la capacité d'accueil est "saturé"
            var capaciteAccueilBT = item.CapaciteAccueilBT;
            if (capaciteAccueilBT === 'saturé') {
                capaciteAccueilBT = '<span style="color: red;">saturé</span>';
            }

            var info = `
                <p><span>Alimenté par le poste HTA/BT :</span> ${item.PosteHTABT || 'N/A'}</p>
                <p><span>Distance par rapport au poste HTA/BT :</span> ${item.Distance || 'N/A'}m</p>
				<p><span>Type de poste :</span> ${item.TypePoste || 'N/A'}</p>
                <p><span>Propriétaire du poste :</span> ${item.PropriétairePoste || 'N/A'}</p>
                <p><span>Puissance du poste :</span> ${item.PuissancePosteKVA || 'N/A'} kVA</p>
                <p><span>Feeder :</span> ${item.Feeder || 'N/A'}</p>
                <p></p> <!-- Ajout d'un espace -->
                <h4>Suivi des ENR sur ce poste HTA/BT</h4>
                <p><span>Nombre d'installations ENR déjà raccordées :</span> ${item.NbInstallationsSolairesRaccordées || 'N/A'}</p>
                <p><span>Puissance ENR déjà raccordée :</span> ${item.PuissanceSolaireRaccordée || 'N/A'} kWc</p>
                <p><span>Nombre de projets ENR en cours :</span> ${item.NbInstallationsSolairesEnCours || 'N/A'}</p>
                <p><span>Puissance des projets ENR en cours :</span> ${item.PuissanceSolaireEnCours || 'N/A'} kWc</p>
				<p><span>Capacité d'accueil du réseau BT :</span> ${capaciteAccueilBT || 'N/A'}</p>
                <button id="close-property-window" style="position: absolute; top: 10px; right: 10px;">X</button>
            `;

            var marker = {
                marker: L.marker([coords.lat, coords.lng], { icon: smallIcon }),
                reference: item.Reference,
                PosteHTABT: item.PosteHTABT,  // Assurez-vous de récupérer la clé PosteHTABT ici
                info: info
            };
            markers.push(marker);
        }
    });
}

// Fonction de recherche activée par le bouton "Recherche Ref Tech" ou en appuyant sur Entrée
function searchReference() {
    var searchText = document.getElementById('search-input').value.toLowerCase();
    var found = false;  // Pour suivre si on a trouvé une correspondance

    // Retirer le marqueur actuel de la carte s'il existe
    if (currentMarker && map.hasLayer(currentMarker.marker)) {
        map.removeLayer(currentMarker.marker);
        if (currentMarker.label) {
            map.removeLayer(currentMarker.label);
        }
    }

    // Retirez l'ancienne couche GeoJSON avant de charger une nouvelle couche
    if (currentGeoJSONLayer) {
        map.removeLayer(currentGeoJSONLayer);
        currentGeoJSONLayer = null;
    }

    // On parcourt les marqueurs pour trouver celui qui correspond à la recherche
    markers.forEach(function(item) {
        if (found) return;

        if (typeof item.reference === 'string' && item.reference.toLowerCase().includes(searchText)) {
            item.marker.addTo(map);
            map.flyTo(item.marker.getLatLng(), 18);
            updatePropertyWindow(`Référence Technique : ${item.reference}`, item.info);

            var label = addLabelToMarker(item.marker, item.reference);
            currentMarker = { marker: item.marker, label: label };  // Stocke le marqueur courant
            found = true;

            // Charger le fichier GeoJSON associé au poste HTA/BT
            loadGeoJSONForPosteHTABT(item.PosteHTABT);
        }
    });

    // Si la barre de recherche est vide, enlever le marqueur et le label
    if (searchText === '') {
        if (currentMarker && map.hasLayer(currentMarker.marker)) {
            map.removeLayer(currentMarker.marker);
            if (currentMarker.label) {
                map.removeLayer(currentMarker.label);
            }
        }
        document.getElementById('property-window').style.display = 'none';  // Cacher la fenêtre de propriété
        currentMarker = null;

        // Supprimer également la couche GeoJSON si présente
        if (currentGeoJSONLayer) {
            map.removeLayer(currentGeoJSONLayer);
            currentGeoJSONLayer = null;
        }
    }
}



// Événement pour le bouton de recherche
document.getElementById('search-button').addEventListener('click', searchReference);

// Événement pour la touche "Entrée" dans la barre de recherche
document.getElementById('search-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchReference();
    }
});

// Fonction pour fermer la fenêtre de propriété et retirer le marqueur de la carte
function closePropertyWindow() {
    if (currentMarker && map.hasLayer(currentMarker.marker)) {
        map.removeLayer(currentMarker.marker);
        if (currentMarker.label) {
            map.removeLayer(currentMarker.label);
        }
    }
    document.getElementById('property-window').style.display = 'none';
    currentMarker = null;

    // Retirez également la couche GeoJSON si elle est présente
    if (currentGeoJSONLayer) {
        map.removeLayer(currentGeoJSONLayer);
        currentGeoJSONLayer = null;
    }
}

// Ajout d'un événement global pour fermer la fenêtre de propriété lorsque le bouton "X" est cliqué
document.getElementById('property-window').addEventListener('click', function(e) {
    if (e.target.id === 'close-property-window') {
        closePropertyWindow();
    }
});

