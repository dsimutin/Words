# Words Web App

Google Apps Script web application for 3–4 students. It reads vocabulary and verbs from configured spreadsheet tabs, keeps progress in service sheets, serves private Drive images through Apps Script, and provides a teacher dashboard.

Deployment settings: execute as the deploying user; access for anyone.

## Automated deployment

The project is connected to Google Apps Script through `clasp`. To run all
tests, push the server files, create a version, and update the existing web app
deployment without changing its URL, run:

```sh
./apps-script/deploy.command "Words — description of the update"
```

The first setup requires `npx @google/clasp login` and enabling the Google Apps
Script API at `https://script.google.com/home/usersettings`.
