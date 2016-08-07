upstream app_fastonosql {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name fastonosql.com fastonosql;
    access_log /var/log/nginx/fastonosql.log;

    location / {
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header Host $http_host;
      proxy_set_header X-NginX-Proxy true;

      proxy_pass http://app_fastonosql/;
      proxy_redirect off;
    }
}
