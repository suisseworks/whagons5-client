import '../styles/Header.css';

export const Header = () => {

  const profilePictureUrl = 'https://dingdonecdn-whagons.fra1.digitaloceanspaces.com/dingdone/ijWBZNvTmqTLIlxAQmVBWAI9Nd6sePPxUoGOpg7y.jpg';

  return (
    <header className="header">
      <h1>Whagons</h1>
      <div className="profile-container">
        <img src={profilePictureUrl} alt="Foto de perfil" className="profile-img" />
      </div>
    </header>
  )
}
