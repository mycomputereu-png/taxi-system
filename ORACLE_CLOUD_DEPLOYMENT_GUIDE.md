# Ghid de Deployment pentru Oracle Cloud Infrastructure (OCI)

Acest ghid te va ajuta să deployezi aplicația Taxi System (Dispatcher) pe o instanță Oracle Cloud, folosind Docker, Docker Compose, Nginx și GitHub Actions pentru Continuous Deployment.

## 1. Pregătirea Instanței Oracle Cloud

### 1.1 Crearea unei Instanțe Compute

1.  **Loghează-te** în consola Oracle Cloud.
2.  Navighează la **Compute > Instances** și click pe **Create Instance**.
3.  **Alege un nume** pentru instanță (ex: `taxi-dispatcher-server`).
4.  **Alege un Placement**: Selectează un Availability Domain.
5.  **Image and Shape**:
    *   **Image**: Recomand `Ubuntu 22.04` (sau o versiune mai nouă).
    *   **Shape**: Poți folosi o formă "Always Free" (ex: `VM.Standard.E2.1.Micro` pentru x86 sau `VM.Standard.A1.Flex` cu 1 OCPU și 6GB RAM pentru ARM - Ampere).
6.  **Networking**:
    *   Selectează un Virtual Cloud Network (VCN) existent sau creează unul nou.
    *   Asigură-te că instanța are o **adresă IP publică**.
7.  **Add SSH keys**: Generează o nouă pereche de chei SSH sau încarcă cheia ta publică existentă. **Păstrează cheia privată în siguranță!** Vei avea nevoie de ea pentru a te conecta la instanță și pentru GitHub Actions.
8.  Click pe **Create**.

### 1.2 Configurarea Regulilor de Firewall (Security List)

Pentru a permite accesul la aplicație, trebuie să deschizi porturile necesare în VCN-ul tău:

1.  Navighează la **Networking > Virtual Cloud Networks**.
2.  Click pe VCN-ul asociat instanței tale.
3.  Click pe **Security Lists** și apoi pe lista de securitate implicită (sau creează una nouă).
4.  Adaugă următoarele **Ingress Rules**:
    *   **Source CIDR**: `0.0.0.0/0` (permite accesul de oriunde)
    *   **IP Protocol**: `TCP`
    *   **Destination Port Range**: `22` (pentru SSH)
    *   **Destination Port Range**: `80` (pentru HTTP - Nginx)
    *   **Destination Port Range**: `443` (pentru HTTPS - Nginx, dacă vei configura SSL)
    *   **Destination Port Range**: `3000` (pentru acces direct la backend, dacă este necesar, dar Nginx va proxy-a)

## 2. Instalarea Docker și Docker Compose pe Instanța OCI

Conectează-te la instanța ta OCI folosind SSH:

```bash
ssh -i /path/to/your/private/key ubuntu@<YOUR_OCI_PUBLIC_IP>
```

Rulează următoarele comenzi pentru a instala Docker și Docker Compose:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker ubuntu
newgrp docker
```

## 3. Pregătirea Proiectului pe Instanța OCI

1.  **Creează un director** pentru aplicația ta pe instanța OCI (ex: `/home/ubuntu/taxi-system`):
    ```bash
    mkdir -p /home/ubuntu/taxi-system
    cd /home/ubuntu/taxi-system
    ```
2.  **Creează un fișier `.env`** cu variabilele de mediu pentru baza de date. Acesta **NU** trebuie să fie în Git! Exemplu:
    ```dotenv
    DB_ROOT_PASSWORD=your_mysql_root_password
    DB_NAME=taxi_db
    DB_USER=taxi_user
    DB_PASSWORD=your_taxi_db_password
    ```
    *Asigură-te că aceste credențiale sunt puternice și unice.*

## 4. Configurarea GitHub Secrets pentru Continuous Deployment

Pentru ca GitHub Actions să poată deploya automat codul pe instanța ta OCI, trebuie să configurezi următoarele secrete în depozitul tău GitHub:

1.  Navighează la depozitul tău GitHub (`https://github.com/mycomputereu-png/taxi-system`).
2.  Click pe **Settings > Secrets and variables > Actions**.
3.  Click pe **New repository secret** și adaugă următoarele:
    *   `DOCKER_USERNAME`: Numele tău de utilizator Docker Hub.
    *   `DOCKER_PASSWORD`: Parola ta Docker Hub.
    *   `OCI_HOST`: Adresa IP publică a instanței tale Oracle Cloud.
    *   `OCI_USERNAME`: Numele de utilizator SSH pentru instanța OCI (de obicei `ubuntu`).
    *   `OCI_SSH_PRIVATE_KEY`: **Conținutul cheii tale private SSH** (copiază tot conținutul fișierului `.pem` sau `.key`, inclusiv `-----BEGIN ... PRIVATE KEY-----` și `-----END ... PRIVATE KEY-----`).

## 5. Deployment Inițial și Continuous Deployment

### 5.1 Deployment Inițial (Manual)

Pentru primul deployment, va trebui să transferi manual fișierele Docker și Nginx pe instanța OCI. După aceea, GitHub Actions va prelua automat.

1.  **Creează o arhivă** cu fișierele de deployment (Dockerfile-uri, docker-compose.yml, nginx.conf, deploy.sh) pe mașina ta locală.
2.  **Transferă arhiva** pe instanța OCI folosind `scp`:
    ```bash
    scp -i /path/to/your/private/key /path/to/your/deployment_archive.zip ubuntu@<YOUR_OCI_PUBLIC_IP>:/home/ubuntu/taxi-system/
    ```
3.  **Conectează-te la OCI** și extrage arhiva:
    ```bash
    ssh -i /path/to/your/private/key ubuntu@<YOUR_OCI_PUBLIC_IP>
    cd /home/ubuntu/taxi-system
    unzip deployment_archive.zip
    chmod +x deploy.sh
    ```
4.  **Rulează scriptul de deployment** (prima dată va construi imaginile local, apoi le va rula):
    ```bash
    ./deploy.sh
    ```

### 5.2 Continuous Deployment (Automat cu GitHub Actions)

După ce ai configurat secretele GitHub și ai făcut un push pe ramura `main` (sau ai rulat manual workflow-ul din GitHub Actions), procesul va fi automat:

1.  **Fă modificări** în codul proiectului tău.
2.  **Comite și împinge (Push)** modificările pe ramura `main` a depozitului tău GitHub.
3.  **GitHub Actions** va detecta push-ul, va construi imaginile Docker, le va împinge pe Docker Hub și apoi se va conecta la instanța ta OCI via SSH pentru a rula comenzile de update (pull, down, up).

**Verifică statusul deployment-ului** în secțiunea **Actions** a depozitului tău GitHub.

## 6. Accesarea Aplicației

După un deployment reușit, aplicația ta va fi accesibilă la adresa IP publică a instanței tale OCI (ex: `http://<YOUR_OCI_PUBLIC_IP>`).

**Notă**: Pentru a configura SSL (HTTPS) și un domeniu personalizat, va trebui să configurezi Nginx corespunzător și să obții un certificat SSL (ex: Let's Encrypt). Acest lucru depășește scopul acestui ghid inițial, dar este un pas recomandat pentru producție.
