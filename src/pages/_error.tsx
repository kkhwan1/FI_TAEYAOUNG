import { NextPageContext } from 'next';

interface ErrorProps {
  statusCode?: number;
}

function Error({ statusCode }: ErrorProps) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '32px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        maxWidth: '400px'
      }}>
        <h1 style={{ fontSize: '48px', fontWeight: 'bold', color: '#ef4444', marginBottom: '16px' }}>
          {statusCode || 'Error'}
        </h1>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>
          {statusCode === 404 ? '페이지를 찾을 수 없습니다' : '오류가 발생했습니다'}
        </h2>
        <p style={{ color: '#6b7280', marginBottom: '24px' }}>
          {statusCode === 404
            ? '요청하신 페이지가 존재하지 않습니다.'
            : '서버에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'}
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            backgroundColor: '#4b5563',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: '500'
          }}
        >
          홈으로 이동
        </a>
      </div>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
