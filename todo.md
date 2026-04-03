# Taxi System - TODO

## Backend & Database
- [x] Schema DB: tabele drivers, clients, rides, locations, otp_codes
- [x] Migrare SQL și aplicare în DB
- [x] WebSocket server cu Socket.IO
- [x] tRPC router: autentificare dispatcher (admin)
- [x] tRPC router: autentificare șofer (username/password)
- [x] tRPC router: autentificare client (telefon + OTP simulat)
- [x] tRPC router: gestionare șoferi (CRUD)
- [x] tRPC router: curse (creare, asignare, acceptare, refuz, finalizare)
- [x] tRPC router: actualizare locație în timp real
- [x] tRPC router: istoric curse
- [x] WebSocket events: location_update, ride_assigned, ride_accepted, ride_rejected

## Aplicație Dispatcher (/dispatcher)
- [x] Login dispatcher (admin Manus OAuth)
- [x] Layout cu sidebar și navigare
- [x] Tab Hartă: Google Maps cu locații șoferi și clienți în timp real
- [x] Tab Șoferi: adăugare șofer (username/parolă), listare, ștergere
- [x] Tab Curse Active: listare curse pendinte și asignate
- [x] Asignare manuală cursă la șofer disponibil
- [x] Notificare când client cere taxi
- [x] Status șofer (disponibil/ocupat) vizibil pe hartă

## Aplicație Client (/client)
- [x] Pagină login cu număr de telefon
- [x] Generare și verificare OTP (simulat în app)
- [x] Pagină principală cu hartă Google Maps
- [x] Buton "Cheamă Taxi" proeminent
- [x] Trimitere locație GPS la dispatcher via WebSocket
- [x] Stare așteptare după cerere taxi
- [x] Tracking șofer în timp real după acceptare
- [x] Rută albastră de la șofer la client pe hartă
- [x] Timp estimat de sosire
- [x] Notificare când șoferul acceptă cursa

## Aplicație Șofer (/driver)
- [x] Login cu username/parolă (create de dispatcher)
- [x] Pagină principală cu status disponibil/ocupat
- [x] Notificare cursă nouă asignată
- [x] Card cursă cu detalii client și locație
- [x] Butoane Acceptă/Refuză cursă
- [x] Hartă Google Maps cu navigare la client după acceptare
- [x] Rută albastră la locația clientului
- [x] Actualizare locație GPS în timp real
- [x] Buton "Cursă Finalizată"

## Integrare & Calitate
- [x] WebSocket rooms pentru dispatcher, client, șofer
- [x] Teste Vitest pentru proceduri backend
- [x] Design consistent dark theme profesional
- [x] Responsive mobile pentru client și șofer
- [x] Tracking live șoferi pe hartă Dispatcher cu marcatori animați
- [x] Panel statistici în sidebar (total șoferi, curse, disponibili)
- [x] Dark theme Google Maps în Dispatcher
- [x] Checkpoint final și livrare
- [x] Fixa eroare Client OTP - validare și mesaje de eroare
