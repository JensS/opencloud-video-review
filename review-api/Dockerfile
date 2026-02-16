FROM node:22-alpine
WORKDIR /app
COPY server.js view.html ./
RUN mkdir -p /data
VOLUME /data
EXPOSE 3456
CMD ["node", "server.js"]
