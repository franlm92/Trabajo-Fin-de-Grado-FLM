FROM node

# Set the working directory
WORKDIR /srv/src

# Copy our package.json & install our dependencies
COPY package.json /srv/src/package.json
RUN yarn install

# Copy the remaining application code
COPY . /srv/src

# Add docker-compose-wait tool
ENV WAIT_VERSION 2.7.2
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/$WAIT_VERSION/wait /wait
RUN chmod +x /wait

# Start the app
#CMD yarn start
