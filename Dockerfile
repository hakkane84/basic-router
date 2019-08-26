FROM debian:jessie-slim
FROM node:8
LABEL maintainer="Salva Herrera <keops_cc@outlook.com>, modified from Michael Lynch <michael@mtlynch.io>"

ARG SIA_VERSION="1.4.1.1"
ARG SIA_PACKAGE="Sia-v${SIA_VERSION}-linux-amd64"
ARG SIA_ZIP="${SIA_PACKAGE}.zip"
ARG SIA_RELEASE="https://sia.tech/static/releases/${SIA_ZIP}"
ARG SIA_DIR="/sia"
ARG SIA_DATA_DIR="/sia-data"

RUN apt-get update && apt-get install -y \
  socat \
  wget \
  unzip

RUN wget "$SIA_RELEASE" && \
      mkdir "$SIA_DIR" && \
      unzip -j "$SIA_ZIP" "${SIA_PACKAGE}/siac" -d "$SIA_DIR" && \
      unzip -j "$SIA_ZIP" "${SIA_PACKAGE}/siad" -d "$SIA_DIR"

# Workaround for backwards compatibility with old images, which hardcoded the
# Sia data directory as /mnt/sia. Creates a symbolic link so that any previous
# path references stored in the Sia host config still work.
RUN ln --symbolic "$SIA_DATA_DIR" /mnt/sia

# Clean up.
RUN apt-get remove -y wget unzip && \
    rm "$SIA_ZIP" && \
    rm -rf /var/lib/apt/lists/* && \
    rm -Rf /usr/share/doc && \
    rm -Rf /usr/share/man && \
    apt-get autoremove -y && \
    apt-get clean

EXPOSE 9981 9982

WORKDIR "$SIA_DIR"

ENV SIA_DATA_DIR "$SIA_DATA_DIR"


# NODE.JS PART

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied where available (npm@5+)
COPY package*.json ./

RUN npm install

# Bundle app source and ushb
COPY router.js .

# Adding a mock apipassword for Sia
#COPY apipassword /root/.sia/apipassword

EXPOSE 3500

# Starts the router, which will launch also siad programatically
CMD [ "npm", "start" ]
