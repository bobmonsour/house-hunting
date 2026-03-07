# This is a 'thinking out loud' document for a house hunting app

We are looking for a house to buy, and we want to build a web app to help us with that. The app will have the following features:

- Consume a list of houses that we are considering; these will be added manually in a markdown file
- For each house, research the following:
  - The price of the house
  - The size of the house (in square feet)
  - The number of bedrooms and bathrooms
  - The nature of the neighborhood (amenities, community, etc.)
  - The age of the house
  - Presence or absense of sidewalks on the street
  - The proximity to parks and other outdoor spaces
  - The risk of natural disasters, particularly flooding and fire
  - Crime ratings from reputable crime reporting sources
  - Distance to the nearest of the following places:
    - Whole Foods Market
    - Trader Joe's
    - Costco
    - Target
    - Home Depot
    - Republik Coffee in Pasadena
  - Images of the house from Redfin, Zillow, Trulia, Realtor.com
  - The listing agent's name and contact information
  - The date the house was listed for sale
  - Any price reductions that have occurred since the house was listed
  - The date the house was last sold, and the price it was sold for
  - The estimated value of the house from Zillow and Redfin

## Hosted vs Local-Only

The app should be hostable on a public hosting service with the ability to add password protection. It should be a static site that can be built locally and then pushed to a hosting service; specifically Cloudflare Workers.

## Source of Data

Addresses will be added manually to a markdown file, from which the app can consume the data and perform the necessary research to populate the app with the information listed above. The research will be done using web scraping and APIs from various sources such as Zillow, Redfin, and crime reporting websites.

## Tech Stack

Eleventy would be an ideal choice as it will be built locally, has excellent support for global data files for storage of the researched information, and can be easily deployed to Cloudflare Workers. We can use Node.js for the web scraping and API calls to gather the necessary data about each house.

## Answers to your questions

1. Could be up to 50 houses over time.
2. Single md file with one line per house, containing the address
3. Store the images locally, but they would then be uploaded to the hosting service along with the rest of the app's static assets.
4. Card view with key stats, click to expand would be ideal.
5. A comparison view would be nice for up to 3 houses side by side, with a single image at the top and the key stats below it in a table format.
6. No need for weighted scoring.
7. Rich/editorial design tone
8. Both light and dark mode.
9. Simple shared password.
10. Would be nice to have notes and favorites, but how would we do that for a static site?
11. Driving time and miles are suffient.
