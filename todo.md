# Taxi System - TODO

## ✅ COMPLETAT: Sistem complet de taxi cu trei aplicații web
- Dispatcher: gestionare curse, șoferi, și clienți cu rating-uri
- Client: login OTP, cheamă taxi, tracking live șofer
- Șofer: login, acceptare curse, rating clienți, navigare
- WebSocket real-time cu Socket.IO
- Google Maps cu marcatori și rute
- Sistem de rating clienți cu istoric complet

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
- [x] Fixa ReferenceError require is not defined - dynamic import socket.io-client
- [x] Fixa Map container not found - adaugă check și loading state
- [x] Fixa Socket.IO timing - Dispatcher se conectează înainte de a emite auth
- [x] Adaugă logging pentru Socket.IO events
- [x] Fixa buton Cheamă Taxi - adaugă fallback GPS și buton test locație simulată
- [x] Rearanjare taburi Dispatcher: Curse în așteptare → Curse active → Șoferi online
- [x] Adaugă legendă hartă cu buline colorate: șoferi disponibili (verde), șoferi ocupați (albastru), clienți în așteptare (roșu)
- [x] Adaugă hartă Google Maps pe aplicația Șofer cu locația în timp real
- [x] Adaugă legendă hartă Șofer (locația mea portocaliu, client roșu)
- [x] Adaugă schema DB pentru ratings (tabelă client_ratings)
- [x] Adaugă tRPC procedure pentru submitRating pe Șofer
- [x] Adaugă UI rating pe aplicația Șofer (după finalizare cursă)
- [x] Adaugă tab "Clienți" în Dispatcher cu lista și rating-uri
- [x] Afișare clienți cu probleme (rating scăzut) în Dispatcher
- [x] Extinde backend getClientProfile cu driver info în ratings
- [x] Adaugă modal profil client în Dispatcher cu detalii complete
- [x] Adaugă query backend pentru istoric curse client cu ratinguri primite
- [x] Adaugă procedure tRPC pentru getClientProfile (dispatcher.getClientProfile)
- [x] Construieste pagina profil client cu istoric curse (ClientProfile.tsx)
- [x] Afișare ratinguri primite de client de la șoferi cu driver info
- [x] Adaugă modal profil client în Dispatcher cu click pe card client
- [x] Adaugă sorting/filtering pentru ratinguri (newest, oldest, highest, lowest)
- [x] Adaugă sorting/filtering pentru curse (newest, oldest, completed, cancelled)
- [x] Teste Vitest pentru dispatcher.getClientProfile (9 teste trec)
- [x] Adaugă coloane carPlate și carBrand în tabelul drivers
- [x] Creare și aplicare migrație DB (auto-run la startup din server/db.ts)
- [x] Extinde tRPC addDriver cu câmpuri mașină (opționale)
- [x] Adaugă input fields în formularul Dispatcher ("Numărul mașinii", "Marca automobilului")
- [x] Afișare info mașină în lista șoferilor cu emoji (🚗 placa, 📍 marca)
- [x] Teste Vitest pentru noile câmpuri (9 teste trec)
