import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import open from 'open';

async function authorization() {
    const credentials = JSON.parse(fs.readFileSync('credentials.json'));
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const OAuthorization = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    if (fs.existsSync('token.json')) {
        OAuthorization.setCredentials(JSON.parse(fs.readFileSync('token.json')));
        return OAuthorization;
    }
    const authorizationURL = OAuthorization.generateAuthUrl({access_type: 'offline', scope: ['https://www.googleapis.com/auth/gmail.modify'],})
    console.log('Authorize: ', authorizationURL);
    await open(authorizationURL);
    const code = await new Promise(resolve => {process.stdin.once('data', data => resolve(data.toString().trim()));});
    const { tokens } = await OAuthorization.getToken(code);
    OAuthorization.setCredentials(tokens);
    fs.writeFileSync('token.json', JSON.stringify(tokens));
    return OAuthorization;
}

async function trashEmails() {
    const authorize = await authorization();
    const gmail = google.gmail({ version: 'v1', auth: authorize });
    const query = '-label:STARRED';
    let total_trashed = 0;
    const seen = new Set();
    let trashing_check = true;
    while (trashing_check) {
        const response = await gmail.users.messages.list({userId: 'me', q: query, maxResults: 500});
        const messages = response.data.messages || [];
        if (!messages.length) break;
        const ids = messages.map(x => x.id).filter(id => !seen.has(id));
        if (!ids.length) break;
        ids.forEach(id => seen.add(id));
        await gmail.users.messages.batchModify({userId: 'me', requestBody: {ids, addLabelIds: ['TRASH'],},});
        total_trashed += ids.length;
        console.log(`Currently trashed ${total_trashed} emails...`);
    }
    console.log(`Trashed ${total_trashed} emails!`);
}

trashEmails().catch(console.error);