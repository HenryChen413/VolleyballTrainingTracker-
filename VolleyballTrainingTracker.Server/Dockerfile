# 請參閱 https://aka.ms/customizecontainer 了解如何自訂您的偵錯容器，以及 Visual Studio 如何使用此 Dockerfile 來組建您的映像，以加快偵錯速度。

# 根據將建置或執行容器的主機作業系統，FROM 陳述式中指定的映像可能需要變更。
# 如需詳細資訊，請參閱 https://aka.ms/containercompat

# 此階段用於以快速模式從 VS 執行時 (偵錯設定的預設值)
FROM mcr.microsoft.com/dotnet/aspnet:8.0-nanoserver-1809 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081


# 此階段是用來組建服務專案
FROM mcr.microsoft.com/dotnet/sdk:8.0-nanoserver-1809 AS with-node
WORKDIR /src
RUN curl https://nodejs.org/dist/v18.18.0/node-v18.18.0-win-x64.zip --output node.zip
RUN tar -xf node.zip
USER ContainerAdministrator
RUN setx /M path "%path%;C:\src\node-v18.18.0-win-x64"
USER ContainerUser


FROM with-node AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["VolleyballTrainingTracker.Server/VolleyballTrainingTracker.Server.csproj", "VolleyballTrainingTracker.Server/"]
COPY ["volleyballtrainingtracker.client/volleyballtrainingtracker.client.esproj", "volleyballtrainingtracker.client/"]
RUN dotnet restore "./VolleyballTrainingTracker.Server/VolleyballTrainingTracker.Server.csproj"
COPY . .
WORKDIR "/src/VolleyballTrainingTracker.Server"
RUN dotnet build "./VolleyballTrainingTracker.Server.csproj" -c %BUILD_CONFIGURATION% -o /app/build

# 此階段可用來發佈要複製到最終階段的服務專案
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./VolleyballTrainingTracker.Server.csproj" -c %BUILD_CONFIGURATION% -o /app/publish /p:UseAppHost=false

# 此階段用於生產環境，或以一般模式從 VS 執行時 (未使用偵錯設定時的預設值)
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "VolleyballTrainingTracker.Server.dll"]
