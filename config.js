/* Armodilo CI Builder settings.
   Edit this file to add customers (importer emails) or part numbers (page 2 metal content).
   Customer keys and part keys must be UPPERCASE and match the FedEx invoice exactly. */
window.CONFIG = {
  "shipper": {
    "lines": [
      "SHIPPING@ARMODILO.COM",
      "ARMODILO DISPLAY SOLUTIONS",
      "350 SHIRLEY AVE, UNIT 5",
      "KITCHENER",
      "ON N2B2E1 CA (519) 206-5000"
    ],
    "id_ein": "80882 8297 RT0001"
  },
  "broker_extra_line": "FedEx Trade Network Acct#:4869598",
  "customers": {
    "COTALITY": {
      "email": "rhenz@cotality.com",
      "importer_id": "n/a"
    }
  },
  "parts": {
    "FLOOR": {
      "diagram": "Armodilo_Floor.pdf",
      "components": [
        {
          "name": "Faceplate Cover",
          "item": "F",
          "hs": "9403.20.0050",
          "qty": 1,
          "material": "Steel",
          "value": 17.66,
          "weight_kg": "0.50",
          "value_label": "Total Component Value",
          "weight_label": "Total Component Weight",
          "origin": [
            [
              "Country of Melt & Pour",
              "United States of America"
            ]
          ],
          "reference": "SDI.pdf"
        },
        {
          "name": "Aluminum Tube",
          "item": "B",
          "hs": "9403.20.0050",
          "qty": 1,
          "material": "Aluminum",
          "value": 58.6,
          "weight_kg": "1.022",
          "origin": [
            [
              "Primary Country of Smelt",
              "United States of America"
            ],
            [
              "Secondary Country of Smelt",
              "United States of America"
            ],
            [
              "Country of Most Recent Cast",
              "United States of America"
            ]
          ],
          "reference": "Hydro.pdf"
        },
        {
          "name": "Base Plate",
          "item": "C",
          "hs": "9403.20.0050",
          "qty": 1,
          "material": "Aluminum",
          "value": 48.33,
          "weight_kg": "2.562",
          "origin": [
            [
              "Primary Country of Smelt",
              "China"
            ],
            [
              "Secondary Country of Smelt",
              "China"
            ],
            [
              "Country of Most Recent Cast",
              "China"
            ]
          ],
          "reference": "Henan.pdf"
        }
      ]
    }
  }
};
