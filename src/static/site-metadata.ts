interface ISiteMetadataResult {
  siteTitle: string;
  siteUrl: string;
  description: string;
  keywords: string;
  logo: string;
  navLinks: {
    name: string;
    url: string;
  }[];
}



const data: ISiteMetadataResult = {
  siteTitle: 'Workouts Map',
  siteUrl: 'https://zhaohongxuan.github.io',
  logo: 'https://avatars.githubusercontent.com/u/8613196?v=4',
  description: 'Personal site and blog',
  keywords: 'workouts, running, cycling, riding, roadtrip, hiking, swimming',
  navLinks: [
    {
      name: 'Strava',
      url: 'https://www.strava.com/athletes/hank_zhao',
    },
    {
      name: 'Blog',
      url: 'https://zhaohongxuan.github.io',
    },
  ],
};

export default data;
